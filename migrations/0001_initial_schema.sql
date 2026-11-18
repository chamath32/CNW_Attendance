-- CNW Workforce Management System
-- Cloudflare D1 Database Schema Migration 0001
-- Timezone Standard: UTC stored in DB, displayed in Asia/Colombo (UTC+05:30)

-- 1. Users Table (Authentication & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                       -- UUID
    username TEXT NOT NULL UNIQUE,             -- e.g. emp001, hr_manager, ceo, admin
    password_hash TEXT NOT NULL,               -- Argon2id or PBKDF2/SHA-256 hash
    role TEXT NOT NULL CHECK (role IN ('EMPLOYEE', 'HR_MANAGER', 'CEO', 'SYSTEM_ADMIN')),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,      -- 1 = active, 0 = disabled
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Employees Table (Workforce profile, salary & rates)
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,                       -- UUID
    user_id TEXT UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    employee_code TEXT NOT NULL UNIQUE,        -- e.g. CNW-E001
    full_name TEXT NOT NULL,
    calling_name TEXT NOT NULL,                -- Name commonly used on site
    nic_number TEXT,                           -- Sri Lankan NIC
    phone TEXT,
    designation TEXT NOT NULL,                 -- Mason, Carpenter, Labourer, Site Supervisor, etc.
    current_daily_rate REAL NOT NULL DEFAULT 0.0, -- Default daily pay (LKR)
    current_ot_rate REAL NOT NULL DEFAULT 0.0,    -- Default OT pay per hour (LKR)
    is_active INTEGER NOT NULL DEFAULT 1,
    joined_date TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- 3. Construction Sites Table
CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,                       -- UUID
    site_code TEXT NOT NULL UNIQUE,            -- e.g. CNW-SITE-01
    name TEXT NOT NULL,                        -- e.g. Colombo High-Rise, Kandy Highway Project
    location TEXT NOT NULL,                    -- City / Area
    address TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(is_active);

-- 4. Devices Table (Registered employee mobile phones)
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,                       -- UUID
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,          -- Client-generated unique fingerprint
    device_model TEXT,                         -- e.g. Samsung Galaxy A14, Xiaomi Redmi 10
    user_agent TEXT,
    is_trusted INTEGER NOT NULL DEFAULT 1,
    registered_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    last_seen_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    revoked_at TEXT,
    revoked_reason TEXT,
    UNIQUE(employee_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_devices_emp ON devices(employee_id);

-- 5. Sessions Table (Secure HTTP Sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                       -- UUID
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    revoked_at TEXT,
    revocation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 6. Attendance Events Table (Append-only core attendance log)
CREATE TABLE IF NOT EXISTS attendance_events (
    id TEXT PRIMARY KEY,                       -- UUID generated on client or server
    session_group_id TEXT NOT NULL,            -- UUID grouping a continuous work session from START to OFF
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL CHECK (event_type IN ('START', 'MOVE', 'OFF')),
    
    -- Timestamps
    device_timestamp TEXT NOT NULL,            -- Local time as captured on the phone (ISO-8601 UTC)
    server_timestamp TEXT NOT NULL DEFAULT (DATETIME('now')), -- Server reception time
    is_offline_created INTEGER NOT NULL DEFAULT 0, -- 1 if created while phone was offline
    synced_at TEXT,                            -- Server sync time
    
    -- Time adjustment audit
    raw_populated_time TEXT NOT NULL,          -- Time originally auto-filled by the device
    effective_event_time TEXT NOT NULL,        -- Effective time entered/corrected by user
    was_time_adjusted INTEGER NOT NULL DEFAULT 0, -- 1 if user modified auto-filled time
    adjustment_reason TEXT,                    -- Mandatory reason if was_time_adjusted = 1
    
    -- Integrity & Audit
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_att_employee ON attendance_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_session_group ON attendance_events(session_group_id);
CREATE INDEX IF NOT EXISTS idx_att_effective_time ON attendance_events(effective_event_time);
CREATE INDEX IF NOT EXISTS idx_att_event_type ON attendance_events(event_type);

-- 7. Attendance Corrections Table (Requests & Audited changes to past records)
CREATE TABLE IF NOT EXISTS attendance_corrections (
    id TEXT PRIMARY KEY,                       -- UUID
    attendance_event_id TEXT NOT NULL REFERENCES attendance_events(id) ON DELETE RESTRICT,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    requested_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    original_time TEXT NOT NULL,
    corrected_time TEXT NOT NULL,
    reason TEXT NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by_user_id TEXT REFERENCES users(id),
    reviewed_at TEXT,
    review_notes TEXT,
    
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_corrections_event ON attendance_corrections(attendance_event_id);
CREATE INDEX IF NOT EXISTS idx_corrections_emp ON attendance_corrections(employee_id);

-- 8. Salary Rate History (Preserves historical rates; changing rate does NOT alter past finalized payroll)
CREATE TABLE IF NOT EXISTS rate_history (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    daily_rate REAL NOT NULL,
    ot_rate REAL NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,                         -- NULL means currently active
    changed_by_user_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_emp ON rate_history(employee_id, effective_from);

-- 9. Daily Payroll Table (Calculated daily working sessions)
CREATE TABLE IF NOT EXISTS daily_payroll (
    id TEXT PRIMARY KEY,
    session_group_id TEXT NOT NULL UNIQUE,     -- Maps to attendance_events session_group_id
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    work_date TEXT NOT NULL,                   -- YYYY-MM-DD
    
    start_time TEXT NOT NULL,                  -- Effective START ISO string
    off_time TEXT NOT NULL,                    -- Effective OFF ISO string
    
    elapsed_hours REAL NOT NULL,               -- Total wall-clock hours
    unpaid_break_hours REAL NOT NULL DEFAULT 1.0, -- Typically 1.0 hr
    paid_hours REAL NOT NULL,                  -- max(0, elapsed - unpaid_break)
    regular_hours REAL NOT NULL,               -- min(8.0, paid_hours)
    overtime_hours REAL NOT NULL,              -- max(0, paid_hours - 8.0)
    shortage_hours REAL NOT NULL,              -- max(0, 8.0 - paid_hours)
    
    -- Frozen rates for this day
    daily_rate_applied REAL NOT NULL,
    ot_rate_applied REAL NOT NULL,
    
    -- Financials (LKR)
    base_pay REAL NOT NULL,                    -- Standard daily salary
    overtime_pay REAL NOT NULL,                -- overtime_hours * ot_rate
    shortage_deduction REAL NOT NULL,          -- shortage_hours * ot_rate
    net_daily_pay REAL NOT NULL,               -- base_pay + overtime_pay - shortage_deduction
    
    is_missing_off INTEGER NOT NULL DEFAULT 0, -- 1 if employee forgot to tap OFF
    is_locked INTEGER NOT NULL DEFAULT 0,      -- 1 if finalized in monthly payroll
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_payroll_emp_date ON daily_payroll(employee_id, work_date);

-- 10. Monthly Payroll Table (Summary per employee per billing period)
CREATE TABLE IF NOT EXISTS monthly_payroll (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    year_month TEXT NOT NULL,                  -- YYYY-MM
    
    total_days_worked INTEGER NOT NULL DEFAULT 0,
    total_paid_hours REAL NOT NULL DEFAULT 0.0,
    total_ot_hours REAL NOT NULL DEFAULT 0.0,
    total_shortage_hours REAL NOT NULL DEFAULT 0.0,
    
    total_base_earnings REAL NOT NULL DEFAULT 0.0,
    total_ot_earnings REAL NOT NULL DEFAULT 0.0,
    total_deductions REAL NOT NULL DEFAULT 0.0,
    net_payable REAL NOT NULL DEFAULT 0.0,
    
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
    submitted_by_user_id TEXT REFERENCES users(id),
    submitted_at TEXT,
    approved_by_user_id TEXT REFERENCES users(id), -- CEO user
    approved_at TEXT,
    rejection_reason TEXT,
    
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    UNIQUE(employee_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_payroll_ym ON monthly_payroll(year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_payroll_status ON monthly_payroll(status);

-- 11. Payroll Approvals Audit Table
CREATE TABLE IF NOT EXISTS payroll_approvals (
    id TEXT PRIMARY KEY,
    monthly_payroll_id TEXT NOT NULL REFERENCES monthly_payroll(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('SUBMIT', 'APPROVE', 'REJECT', 'REOPEN')),
    action_by_user_id TEXT NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

-- 12. System Audit Logs Table (Immutable audit trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,                      -- e.g. LOGIN, ATTENDANCE_START, TIME_CORRECT, PAYROLL_APPROVE
    entity_type TEXT NOT NULL,                 -- e.g. attendance, payroll, user, device
    entity_id TEXT,
    details_json TEXT,                         -- JSON snapshot of changed fields
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- 13. Application Settings Table (Key-Value configuration)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_by_user_id TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

-- Default Settings
INSERT OR IGNORE INTO app_settings (key, value, description) VALUES
('UNPAID_BREAK_HOURS', '1.0', 'Default unpaid lunch break deducted per day (hours)'),
('LUNCH_BREAK_START', '12:00', 'Standard lunch break start window'),
('LUNCH_BREAK_END', '13:00', 'Standard lunch break end window'),
('NORMAL_WORK_HOURS', '8.0', 'Standard working hours required per normal day (8:00 AM - 5:00 PM minus 1h lunch)'),
('NORMAL_DAY_END_TIME', '17:00', 'All hours after 5:00 PM are counted as Overtime (OT)'),
('ALLOW_SELF_OFF_CORRECTION', 'true', 'Allow employees to adjust their own OFF timestamp with a required reason message'),
('CORRECTION_REQUIRES_APPROVAL', 'false', 'Direct update with reason; no blocking supervisor approval needed'),
('COMPANY_NAME', 'CNW Engineering (Pvt) Ltd', 'Official company trade name'),
('COMPANY_EMAIL', 'cnweng.hr@gmail.com', 'Company HR official notification email'),
('GOOGLE_SHEET_ID', '1AFXJ4m4aws1-s9mUbdf_UxrMmN_4xyJJIjo17RikV1c', 'Google Spreadsheet ID for management reporting'),
('TIMEZONE', 'Asia/Colombo', 'Company operational timezone');

-- ==========================================
-- Initial Seed Data (Safe Development Seeds)
-- Passwords will be updated upon first production login
-- ==========================================

-- 1. Default System Administrator (Admin)
INSERT OR IGNORE INTO users (id, username, password_hash, role, full_name, email, phone)
VALUES (
    'usr-admin-001',
    'admin',
    'pbkdf2:10000:cnw-salt:admin123', -- Demo hashed format
    'SYSTEM_ADMIN',
    'CNW System Administrator',
    'admin@cnwengineering.lk',
    '+94770000001'
);

-- 2. CEO Account — Mr. Jayantha Weerathunga
INSERT OR IGNORE INTO users (id, username, password_hash, role, full_name, email, phone)
VALUES (
    'usr-ceo-001',
    'ceo',
    'pbkdf2:10000:cnw-salt:ceo123',
    'CEO',
    'Mr. Jayantha Weerathunga',
    'ceo@cnwengineering.lk',
    '+94770000002'
);

-- 3. HR Manager Account
INSERT OR IGNORE INTO users (id, username, password_hash, role, full_name, email, phone)
VALUES (
    'usr-hr-001',
    'hrmanager',
    'pbkdf2:10000:cnw-salt:hr123',
    'HR_MANAGER',
    'CNW HR Manager',
    'hr@cnwengineering.lk',
    '+94770000003'
);

-- 4. Initial Employee User & Profile
INSERT OR IGNORE INTO users (id, username, password_hash, role, full_name, email, phone)
VALUES (
    'usr-emp-001',
    'kamal',
    'pbkdf2:10000:cnw-salt:emp123',
    'EMPLOYEE',
    'Kamal Perera',
    'kamal@cnwengineering.lk',
    '+94771234567'
);

INSERT OR IGNORE INTO employees (id, user_id, employee_code, full_name, calling_name, nic_number, phone, designation, current_daily_rate, current_ot_rate)
VALUES (
    'emp-001',
    'usr-emp-001',
    'CNW-E001',
    'Kamal Perera',
    'Kamal',
    '198512345678',
    '+94771234567',
    'Senior Mason',
    2000.0,
    300.0
);

-- Initial Rate History for Kamal Perera
INSERT OR IGNORE INTO rate_history (id, employee_id, daily_rate, ot_rate, effective_from, changed_by_user_id, reason)
VALUES (
    'rate-emp-001-init',
    'emp-001',
    2000.0,
    300.0,
    '2026-01-01',
    'usr-hr-001',
    'Initial compensation setup'
);

-- 5. Seed Construction Sites
INSERT OR IGNORE INTO sites (id, site_code, name, location, address)
VALUES 
('site-001', 'CNW-S01', 'Colombo High-Rise (Site A)', 'Colombo 03', 'Galle Road, Kollupitiya'),
('site-002', 'CNW-S02', 'Kandy Commercial Plaza (Site B)', 'Kandy', 'Peradeniya Road, Kandy'),
('site-003', 'CNW-S03', 'Gampaha Residential Complex', 'Gampaha', 'Miriswatta, Gampaha');
