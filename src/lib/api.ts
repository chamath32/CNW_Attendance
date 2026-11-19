import { AttendanceEvent, Site, Employee, User } from '../types';

const STORAGE_KEY_EVENTS = 'cnw_attendance_events';
const STORAGE_KEY_GSHEET_WEBHOOK = 'cnw_google_sheet_webhook';
export const DEFAULT_GSHEET_WEBHOOK = 'https://script.google.com/macros/s/AKfycbwIRPDJSyqDH3vHOMgi-EvwxhG54bOuteKmPWFUvKuZ-vs0m_OPES-wT2xkaSVKlWLNhg/exec';

/**
 * Map raw database row (snake_case) or frontend object (camelCase) to AttendanceEvent
 */
export function mapToAttendanceEvent(row: any): AttendanceEvent {
  return {
    id: row.id,
    sessionGroupId: row.sessionGroupId || row.session_group_id,
    employeeId: row.employeeId || row.employee_id,
    siteId: row.siteId || row.site_id,
    eventType: row.eventType || row.event_type,
    deviceTimestamp: row.deviceTimestamp || row.device_timestamp,
    serverTimestamp: row.serverTimestamp || row.server_timestamp,
    isOfflineCreated: Boolean(row.isOfflineCreated || row.is_offline_created),
    syncedAt: row.syncedAt || row.synced_at,
    rawPopulatedTime: row.rawPopulatedTime || row.raw_populated_time,
    effectiveEventTime: row.effectiveEventTime || row.effective_event_time,
    wasTimeAdjusted: Boolean(row.wasTimeAdjusted || row.was_time_adjusted),
    adjustmentReason: row.adjustmentReason || row.adjustment_reason || undefined,
    createdUserId: row.createdUserId || row.created_by_user_id || row.employeeId || 'usr-system',
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  };
}

/**
 * Load local attendance events from localStorage
 */
export function getLocalAttendanceEvents(): AttendanceEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(mapToAttendanceEvent) : [];
  } catch {
    return [];
  }
}

/**
 * Save attendance events to localStorage
 */
export function saveLocalAttendanceEvents(events: AttendanceEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

/**
 * Automatically sync attendance event to Google Sheet via Webhook
 */
export async function syncToGoogleSheet(
  event: AttendanceEvent,
  employeeName?: string,
  siteName?: string
): Promise<void> {
  const webhookUrl = localStorage.getItem(STORAGE_KEY_GSHEET_WEBHOOK) || DEFAULT_GSHEET_WEBHOOK;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors', // Standard for Google Apps Script Web Apps
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: event.id,
        employeeName: employeeName || event.employeeId,
        employeeCode: event.employeeId,
        siteName: siteName || event.siteId,
        eventType: event.eventType,
        effectiveEventTime: event.effectiveEventTime,
        wasTimeAdjusted: event.wasTimeAdjusted,
        adjustmentReason: event.adjustmentReason || '',
        deviceTimestamp: event.deviceTimestamp,
      }),
    });
  } catch (err) {
    console.warn('Google Sheet automatic sync error:', err);
  }
}

/**
 * Fetch attendance events from Cloudflare Worker API (or fallback to local storage)
 */
export async function apiFetchAttendance(): Promise<AttendanceEvent[]> {
  try {
    const res = await fetch('/api/attendance', { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const events = data.map(mapToAttendanceEvent);
        saveLocalAttendanceEvents(events);
        return events;
      }
    }
  } catch {
    // Backend offline / development mode: fallback to local storage
  }
  return getLocalAttendanceEvents();
}

/**
 * Record a new attendance event to Cloudflare Worker D1 and persist locally
 */
export async function apiRecordAttendance(
  event: AttendanceEvent,
  employeeName?: string,
  siteName?: string
): Promise<boolean> {
  // 1. Immediately persist locally
  const current = getLocalAttendanceEvents();
  const existingIdx = current.findIndex((e) => e.id === event.id);
  let updated: AttendanceEvent[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = event;
  } else {
    updated = [...current, event];
  }
  saveLocalAttendanceEvents(updated);

  // 2. Transmit to Cloudflare Worker API (D1 Database)
  try {
    fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: event.id,
        sessionGroupId: event.sessionGroupId,
        employeeId: event.employeeId,
        siteId: event.siteId,
        eventType: event.eventType,
        deviceTimestamp: event.deviceTimestamp,
        isOfflineCreated: event.isOfflineCreated,
        rawPopulatedTime: event.rawPopulatedTime,
        effectiveEventTime: event.effectiveEventTime,
        wasTimeAdjusted: event.wasTimeAdjusted,
        adjustmentReason: event.adjustmentReason,
        createdUserId: event.createdUserId,
      }),
    }).catch(() => {});
  } catch {
    // Network failure
  }

  // 3. Automatically sync to Google Sheet webhook
  syncToGoogleSheet(event, employeeName, siteName);

  return true;
}

/**
 * Map raw database row (snake_case) or frontend object to Employee
 */
export function mapToEmployee(row: any): Employee {
  return {
    id: row.id,
    userId: row.userId || row.user_id || '',
    employeeCode: row.employeeCode || row.employee_code || 'CNW-EMP',
    fullName: row.fullName || row.full_name || 'Employee',
    callingName: row.callingName || row.calling_name || (row.fullName || row.full_name || '').split(' ')[0] || 'Employee',
    nicNumber: row.nicNumber || row.nic_number || undefined,
    phone: row.phone || undefined,
    designation: row.designation || 'Site Worker',
    currentDailyRate: Number(row.currentDailyRate ?? row.current_daily_rate ?? 2000),
    currentOtRate: Number(row.currentOtRate ?? row.current_ot_rate ?? 300),
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
  };
}

/**
 * Map raw database row (snake_case) or frontend object to Site
 */
export function mapToSite(row: any): Site {
  return {
    id: row.id,
    siteCode: row.siteCode || row.site_code || 'CNW-S01',
    name: row.name,
    location: row.location,
    address: row.address || undefined,
    contactPerson: row.contactPerson || row.contact_person || undefined,
    contactPhone: row.contactPhone || row.contact_phone || undefined,
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
  };
}

/**
 * Fetch sites from Cloudflare D1
 */
export async function apiFetchSites(): Promise<Site[] | null> {
  try {
    const res = await fetch('/api/sites');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map(mapToSite);
      }
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Fetch employees from Cloudflare D1
 */
export async function apiFetchEmployees(): Promise<Employee[] | null> {
  try {
    const res = await fetch('/api/employees');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map(mapToEmployee);
      }
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Authenticate against Cloudflare Worker D1 backend
 */
export async function apiLogin(
  username: string,
  password: string
): Promise<{ user: User; employee: Employee | null } | null> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        return {
          user: data.user,
          employee: data.employee ? mapToEmployee(data.employee) : null,
        };
      }
    }
  } catch {
    // fallback
  }
  return null;
}
