import { useState, useEffect } from 'react';
import { User, Employee, Site, AttendanceEvent } from './types';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { ManagementDashboard } from './components/ManagementDashboard';
import { LoginPage } from './components/LoginPage';
import {
  apiFetchAttendance,
  apiRecordAttendance,
  apiFetchEmployees,
  apiFetchSites,
  getLocalAttendanceEvents,
  saveLocalAttendanceEvents,
} from './lib/api';
import { LogOut, KeyRound } from 'lucide-react';
import { ChangePasswordModal } from './components/ChangePasswordModal';

// Initial Empty Employees list (strictly managed via Sign-Up & HR Manager)
const INITIAL_EMPLOYEES: Employee[] = [];

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

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem('cnw_employees_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_EMPLOYEES;
  });
  const [sites, setSites] = useState<Site[]>(() => {
    try {
      const saved = localStorage.getItem('cnw_sites_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_SITES;
  });
  // Start with locally stored events or empty array - NO hardcoded dummy events
  const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEvent[]>(() => getLocalAttendanceEvents());

  // Restore authenticated session and sync attendance, employees, and sites on mount
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

    // Load attendance events from Cloudflare D1 / API
    apiFetchAttendance().then((events) => {
      if (events && events.length > 0) {
        setAttendanceEvents(events);
      }
    });

    // Load employees from Cloudflare D1 / API
    apiFetchEmployees().then((apiEmps) => {
      if (apiEmps && apiEmps.length > 0) {
        setEmployees(apiEmps);
        localStorage.setItem('cnw_employees_list', JSON.stringify(apiEmps));
      }
    });

    // Load sites from Cloudflare D1 / API
    apiFetchSites().then((apiSites) => {
      if (apiSites && apiSites.length > 0) {
        setSites(apiSites);
        localStorage.setItem('cnw_sites_list', JSON.stringify(apiSites));
      }
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('cnw_active_session');
    sessionStorage.removeItem('cnw_active_session');
    setCurrentUser(null);
  };

  const handleAddEvent = async (event: AttendanceEvent) => {
    // 1. Immediately update UI state
    setAttendanceEvents((prev) => [...prev, event]);
    // 2. Persist to Cloudflare Worker D1 and Google Sheet
    const emp = employees.find((e) => e.id === event.employeeId);
    const site = sites.find((s) => s.id === event.siteId);
    await apiRecordAttendance(event, emp?.fullName, site?.name);
  };

  const handleCorrectOff = async (sessionGroupId: string, newOffDate: string, newOffTime: string, reason: string) => {
    const newEffectiveISO = new Date(`${newOffDate}T${newOffTime}:00+05:30`).toISOString();

    let targetEvent: AttendanceEvent | null = null;
    const updated = attendanceEvents.map((e) => {
      if (e.sessionGroupId === sessionGroupId && e.eventType === 'OFF') {
        targetEvent = {
          ...e,
          effectiveEventTime: newEffectiveISO,
          wasTimeAdjusted: true,
          adjustmentReason: reason,
        };
        return targetEvent;
      }
      return e;
    });

    setAttendanceEvents(updated);
    saveLocalAttendanceEvents(updated);
    if (targetEvent) {
      const emp = employees.find((e) => e.id === targetEvent!.employeeId);
      const site = sites.find((s) => s.id === targetEvent!.siteId);
      await apiRecordAttendance(targetEvent, emp?.fullName, site?.name);
    }
  };

  // CRUD for Employees
  const handleAddEmployee = (emp: Employee) => {
    setEmployees((prev) => {
      const updated = [...prev, emp];
      localStorage.setItem('cnw_employees_list', JSON.stringify(updated));
      return updated;
    });
  };
  const handleUpdateEmployee = (emp: Employee) => {
    setEmployees((prev) => {
      const updated = prev.map((e) => (e.id === emp.id ? emp : e));
      localStorage.setItem('cnw_employees_list', JSON.stringify(updated));
      return updated;
    });
  };
  const handleDeleteEmployee = (empId: string) => {
    setEmployees((prev) => {
      const updated = prev.filter((e) => e.id !== empId);
      localStorage.setItem('cnw_employees_list', JSON.stringify(updated));
      return updated;
    });
  };

  // CRUD for Sites
  const handleAddSite = (site: Site) => {
    setSites((prev) => {
      const updated = [...prev, site];
      localStorage.setItem('cnw_sites_list', JSON.stringify(updated));
      return updated;
    });
  };
  const handleUpdateSite = (site: Site) => {
    setSites((prev) => {
      const updated = prev.map((s) => (s.id === site.id ? site : s));
      localStorage.setItem('cnw_sites_list', JSON.stringify(updated));
      return updated;
    });
  };
  const handleDeleteSite = (siteId: string) => {
    setSites((prev) => {
      const updated = prev.filter((s) => s.id !== siteId);
      localStorage.setItem('cnw_sites_list', JSON.stringify(updated));
      return updated;
    });
  };

  // If not logged in, show Login Screen
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => setCurrentUser(user)}
        onEmployeeCreated={(newEmp) => handleAddEmployee(newEmp)}
      />
    );
  }

  // If logged in as an EMPLOYEE:
  // Render ONLY EmployeeDashboard. Strict role boundary: NO HR/CEO/Admin views or switcher!
  if (currentUser.role === 'EMPLOYEE') {
    const activeEmployee =
      employees.find((e) => e.userId === currentUser.id) ||
      employees.find((e) => e.fullName?.toLowerCase() === currentUser.fullName?.toLowerCase()) ||
      employees[0] ||
      {
        id: `emp-${currentUser.id}`,
        userId: currentUser.id,
        employeeCode: 'CNW-EMP',
        fullName: currentUser.fullName || 'Employee',
        callingName: (currentUser.fullName || 'Employee').split(' ')[0],
        designation: 'Site Worker',
        currentDailyRate: 2000,
        currentOtRate: 300,
        isActive: true,
      };

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsChangePasswordOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-[#C1F6ED] rounded-lg text-xs font-semibold transition-colors"
            title="Change your account password"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-lg text-xs font-semibold transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
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
          onChangePassword={() => setIsChangePasswordOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* Change Password Modal */}
      {currentUser && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          currentUser={currentUser}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
