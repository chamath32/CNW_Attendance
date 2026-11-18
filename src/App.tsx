import { useState, useEffect } from 'react';
import { User, Employee, Site, AttendanceEvent } from './types';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { ManagementDashboard } from './components/ManagementDashboard';
import { LoginPage } from './components/LoginPage';
import { LogOut } from 'lucide-react';

// Seed Initial Data for Development & Testing
const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-001',
    userId: 'usr-emp-001',
    employeeCode: 'CNW-E001',
    fullName: 'Kamal Perera',
    callingName: 'Kamal',
    designation: 'Senior Mason',
    currentDailyRate: 2000,
    currentOtRate: 300,
    isActive: true,
  },
  {
    id: 'emp-002',
    userId: 'usr-emp-002',
    employeeCode: 'CNW-E002',
    fullName: 'Nimal Silva',
    callingName: 'Nimal',
    designation: 'Lead Carpenter',
    currentDailyRate: 2200,
    currentOtRate: 350,
    isActive: true,
  },
  {
    id: 'emp-003',
    userId: 'usr-emp-003',
    employeeCode: 'CNW-E003',
    fullName: 'Sunil Jayawardena',
    callingName: 'Sunil',
    designation: 'Construction Technician',
    currentDailyRate: 2500,
    currentOtRate: 400,
    isActive: true,
  },
];

const INITIAL_SITES: Site[] = [
  {
    id: 'site-001',
    siteCode: 'CNW-S01',
    name: 'Colombo High-Rise (Site A)',
    location: 'Colombo 03',
    isActive: true,
  },
  {
    id: 'site-002',
    siteCode: 'CNW-S02',
    name: 'Kandy Commercial Plaza (Site B)',
    location: 'Kandy City',
    isActive: true,
  },
  {
    id: 'site-003',
    siteCode: 'CNW-S03',
    name: 'Gampaha Residential Complex',
    location: 'Gampaha',
    isActive: true,
  },
];

// Initial demo attendance session
const INITIAL_ATTENDANCE: AttendanceEvent[] = [
  {
    id: 'evt-init-01',
    sessionGroupId: 'sess-demo-01',
    employeeId: 'emp-001',
    siteId: 'site-001',
    eventType: 'START',
    deviceTimestamp: '2026-11-18T08:00:00Z',
    isOfflineCreated: false,
    rawPopulatedTime: '2026-11-18T08:00:00Z',
    effectiveEventTime: '2026-11-18T08:00:00Z',
    wasTimeAdjusted: false,
    createdUserId: 'usr-emp-001',
    createdAt: '2026-11-18T08:00:00Z',
  },
  {
    id: 'evt-init-02',
    sessionGroupId: 'sess-demo-01',
    employeeId: 'emp-001',
    siteId: 'site-002',
    eventType: 'MOVE',
    deviceTimestamp: '2026-11-18T13:00:00Z',
    isOfflineCreated: false,
    rawPopulatedTime: '2026-11-18T13:00:00Z',
    effectiveEventTime: '2026-11-18T13:00:00Z',
    wasTimeAdjusted: false,
    createdUserId: 'usr-emp-001',
    createdAt: '2026-11-18T13:00:00Z',
  },
  {
    id: 'evt-init-03',
    sessionGroupId: 'sess-demo-01',
    employeeId: 'emp-001',
    siteId: 'site-002',
    eventType: 'OFF',
    deviceTimestamp: '2026-11-18T19:00:00Z',
    isOfflineCreated: false,
    rawPopulatedTime: '2026-11-18T19:00:00Z',
    effectiveEventTime: '2026-11-18T19:00:00Z', // 11h elapsed - 1h break = 10h paid -> 2h OT
    wasTimeAdjusted: true,
    adjustmentReason: 'Extended work for site deadline',
    createdUserId: 'usr-emp-001',
    createdAt: '2026-11-18T19:00:00Z',
  },
];

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [sites, setSites] = useState<Site[]>(INITIAL_SITES);
  const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEvent[]>(INITIAL_ATTENDANCE);

  // Restore authenticated session on app open
  useEffect(() => {
    const saved = localStorage.getItem('cnw_active_session') || sessionStorage.getItem('cnw_active_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.role) {
          setCurrentUser(parsed);
        }
      } catch {
        localStorage.removeItem('cnw_active_session');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('cnw_active_session');
    sessionStorage.removeItem('cnw_active_session');
    setCurrentUser(null);
  };

  const handleAddEvent = async (event: AttendanceEvent) => {
    setAttendanceEvents((prev) => [...prev, event]);
  };

  const handleCorrectOff = async (sessionGroupId: string, newOffTime: string, reason: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newEffectiveISO = new Date(`${today}T${newOffTime}:00`).toISOString();

    setAttendanceEvents((prev) =>
      prev.map((e) => {
        if (e.sessionGroupId === sessionGroupId && e.eventType === 'OFF') {
          return {
            ...e,
            effectiveEventTime: newEffectiveISO,
            wasTimeAdjusted: true,
            adjustmentReason: reason,
          };
        }
        return e;
      })
    );
  };

  // CRUD for Employees
  const handleAddEmployee = (emp: Employee) => {
    setEmployees((prev) => [...prev, emp]);
  };
  const handleUpdateEmployee = (emp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
  };
  const handleDeleteEmployee = (empId: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== empId));
  };

  // CRUD for Sites
  const handleAddSite = (site: Site) => {
    setSites((prev) => [...prev, site]);
  };
  const handleUpdateSite = (site: Site) => {
    setSites((prev) => prev.map((s) => (s.id === site.id ? site : s)));
  };
  const handleDeleteSite = (siteId: string) => {
    setSites((prev) => prev.filter((s) => s.id !== siteId));
  };

  // If not logged in, show Login Screen
  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // If logged in as an EMPLOYEE:
  // Render ONLY EmployeeDashboard. Strict role boundary: NO HR/CEO/Admin views or switcher!
  if (currentUser.role === 'EMPLOYEE') {
    const activeEmployee =
      employees.find((e) => e.userId === currentUser.id) ||
      employees.find((e) => e.employeeCode === 'CNW-E001') ||
      employees[0];

    return (
      <EmployeeDashboard
        employee={activeEmployee}
        sites={sites}
        events={attendanceEvents}
        onAddEvent={handleAddEvent}
        onCorrectOff={handleCorrectOff}
        onLogout={handleLogout}
      />
    );
  }

  // For HR Manager, CEO, or System Administrator:
  return (
    <div className="min-h-screen flex flex-col bg-[#02353C]">
      {/* Top Management Info Bar */}
      <div className="bg-[#012227] text-white border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3FD0C9]" />
          <span className="font-extrabold text-[#C1F6ED] tracking-wide">CNW WORKFORCE</span>
          <span className="text-slate-400">
            &bull; Signed in as: <strong className="text-white">{currentUser.fullName}</strong> ({currentUser.role})
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-lg text-xs font-semibold transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Management Portal */}
      <div className="flex-1 flex flex-col">
        <ManagementDashboard
          currentRole={currentUser.role}
          employees={employees}
          sites={sites}
          attendanceEvents={attendanceEvents}
          onAddEmployee={handleAddEmployee}
          onUpdateEmployee={handleUpdateEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onAddSite={handleAddSite}
          onUpdateSite={handleUpdateSite}
          onDeleteSite={handleDeleteSite}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}

export default App;
