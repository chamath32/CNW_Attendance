import React, { useState } from 'react';
import { UserRole, Employee, Site, AttendanceEvent } from '../types';
import { calculateDailyPayroll } from '../lib/payroll';
import {
  Users,
  Building2,
  DollarSign,
  ShieldCheck,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Clock,
  Send,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  Edit,
  Download,
} from 'lucide-react';

interface ManagementDashboardProps {
  currentRole: UserRole;
  employees: Employee[];
  sites: Site[];
  attendanceEvents: AttendanceEvent[];
  onAddEmployee?: (emp: Employee) => void;
  onUpdateEmployee?: (emp: Employee) => void;
  onDeleteEmployee?: (empId: string) => void;
  onAddSite?: (site: Site) => void;
  onUpdateSite?: (site: Site) => void;
  onDeleteSite?: (siteId: string) => void;
  onLogout?: () => void;
}

export const ManagementDashboard: React.FC<ManagementDashboardProps> = ({
  currentRole,
  employees,
  sites,
  attendanceEvents,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onAddSite,
  onUpdateSite,
  onDeleteSite,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'payroll' | 'audit'>('overview');
  const [payrollStatus, setPayrollStatus] = useState<'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('DRAFT');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);

  // Employee Modal
  const [empModalOpen, setEmpModalOpen] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({
    code: '',
    fullName: '',
    callingName: '',
    phone: '',
    designation: '',
    dailyRate: 2000,
    otRate: 300,
  });

  // Site Modal
  const [siteModalOpen, setSiteModalOpen] = useState<boolean>(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteForm, setSiteForm] = useState({
    siteCode: '',
    name: '',
    location: '',
    address: '',
  });

  // Group events by sessionGroupId to calculate daily payroll
  const sessionGroups: { [groupId: string]: AttendanceEvent[] } = {};
  attendanceEvents.forEach((evt) => {
    if (!sessionGroups[evt.sessionGroupId]) {
      sessionGroups[evt.sessionGroupId] = [];
    }
    sessionGroups[evt.sessionGroupId].push(evt);
  });

  const dailyPayrolls = Object.entries(sessionGroups).map(([groupId, eventsList]) => {
    const sorted = [...eventsList].sort(
      (a, b) => new Date(a.effectiveEventTime).getTime() - new Date(b.effectiveEventTime).getTime()
    );
    const startEvt = sorted.find((e) => e.eventType === 'START');
    const offEvt = sorted.find((e) => e.eventType === 'OFF');
    const emp = employees.find((e) => e.id === startEvt?.employeeId) || employees[0];

    if (!startEvt || !offEvt) {
      return {
        sessionGroupId: groupId,
        employee: emp,
        isMissingOff: !offEvt,
        startEvt,
        offEvt,
        calc: null,
      };
    }

    try {
      const calc = calculateDailyPayroll({
        sessionGroupId: groupId,
        employeeId: emp.id,
        workDate: startEvt.effectiveEventTime.split('T')[0],
        startTime: startEvt.effectiveEventTime,
        offTime: offEvt.effectiveEventTime,
        dailyRate: emp.currentDailyRate,
        otRate: emp.currentOtRate,
        unpaidBreakHours: 1.0,
      });
      return {
        sessionGroupId: groupId,
        employee: emp,
        isMissingOff: false,
        startEvt,
        offEvt,
        calc,
      };
    } catch {
      return {
        sessionGroupId: groupId,
        employee: emp,
        isMissingOff: false,
        startEvt,
        offEvt,
        calc: null,
      };
    }
  });

  const totalPayable = dailyPayrolls.reduce((sum, item) => sum + (item.calc?.netDailyPay || 0), 0);
  const totalOTHours = dailyPayrolls.reduce((sum, item) => sum + (item.calc?.overtimeHours || 0), 0);
  const totalDeductions = dailyPayrolls.reduce((sum, item) => sum + (item.calc?.shortageDeduction || 0), 0);

  // Employee Form submit
  const handleSaveEmployee = () => {
    if (!empForm.fullName || !empForm.callingName) return;
    if (editingEmp && onUpdateEmployee) {
      onUpdateEmployee({
        ...editingEmp,
        fullName: empForm.fullName,
        callingName: empForm.callingName,
        phone: empForm.phone,
        designation: empForm.designation,
        currentDailyRate: Number(empForm.dailyRate),
        currentOtRate: Number(empForm.otRate),
      });
    } else if (onAddEmployee) {
      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        userId: `usr-${Date.now()}`,
        employeeCode: empForm.code || `CNW-E0${employees.length + 1}`,
        fullName: empForm.fullName,
        callingName: empForm.callingName,
        phone: empForm.phone,
        designation: empForm.designation || 'Site Worker',
        currentDailyRate: Number(empForm.dailyRate),
        currentOtRate: Number(empForm.otRate),
        isActive: true,
      };
      onAddEmployee(newEmp);
    }
    setEmpModalOpen(false);
    setEditingEmp(null);
  };

  // Site Form submit
  const handleSaveSite = () => {
    if (!siteForm.name || !siteForm.location) return;
    if (editingSite && onUpdateSite) {
      onUpdateSite({
        ...editingSite,
        name: siteForm.name,
        location: siteForm.location,
        address: siteForm.address,
      });
    } else if (onAddSite) {
      const newSite: Site = {
        id: `site-${Date.now()}`,
        siteCode: siteForm.siteCode || `CNW-S0${sites.length + 1}`,
        name: siteForm.name,
        location: siteForm.location,
        address: siteForm.address,
        isActive: true,
      };
      onAddSite(newSite);
    }
    setSiteModalOpen(false);
    setEditingSite(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Employee', 'Site', 'Date', 'Start Time', 'OFF Time', 'Elapsed (h)', 'Paid (h)', 'OT (h)', 'Net Pay (LKR)'];
    const rows = dailyPayrolls.map((row) => [
      row.employee?.callingName || '',
      sites.find((s) => s.id === row.startEvt?.siteId)?.name || '',
      row.calc?.workDate || '',
      row.startEvt?.effectiveEventTime || '',
      row.offEvt?.effectiveEventTime || '',
      row.calc?.elapsedHours ?? '',
      row.calc?.paidHours ?? '',
      row.calc?.overtimeHours ?? '',
      row.calc?.netDailyPay ?? '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CNW_Payroll_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // State for Individual Employee Monthly CSV Download
  const [selectedEmpForReport, setSelectedEmpForReport] = useState<string>(employees[0]?.id || '');
  const [selectedMonthForReport, setSelectedMonthForReport] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  });

  const handleDownloadSingleEmployeeReport = () => {
    const emp = employees.find((e) => e.id === selectedEmpForReport) || employees[0];
    if (!emp) return;

    // Filter events for this employee in the selected month
    const empEvents = attendanceEvents.filter(
      (e) => e.employeeId === emp.id && e.effectiveEventTime.startsWith(selectedMonthForReport)
    );

    // Group by sessionGroupId
    const groups: { [id: string]: AttendanceEvent[] } = {};
    empEvents.forEach((e) => {
      if (!groups[e.sessionGroupId]) groups[e.sessionGroupId] = [];
      groups[e.sessionGroupId].push(e);
    });

    const rowsData: any[] = [];
    let totPaid = 0;
    let totOT = 0;
    let totShortage = 0;
    let totPay = 0;

    Object.entries(groups).forEach(([groupId, evts]) => {
      const sorted = [...evts].sort(
        (a, b) => new Date(a.effectiveEventTime).getTime() - new Date(b.effectiveEventTime).getTime()
      );
      const startEvt = sorted.find((e) => e.eventType === 'START');
      const offEvt = sorted.find((e) => e.eventType === 'OFF');
      if (!startEvt) return;

      const site = sites.find((s) => s.id === startEvt.siteId);
      const dateStr = startEvt.effectiveEventTime.split('T')[0];
      const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
      const startTimeStr = new Date(startEvt.effectiveEventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const offTimeStr = offEvt
        ? new Date(offEvt.effectiveEventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Missing OFF';

      let calc: any = null;
      if (offEvt) {
        try {
          calc = calculateDailyPayroll({
            sessionGroupId: groupId,
            employeeId: emp.id,
            workDate: dateStr,
            startTime: startEvt.effectiveEventTime,
            offTime: offEvt.effectiveEventTime,
            dailyRate: emp.currentDailyRate,
            otRate: emp.currentOtRate,
            unpaidBreakHours: 1.0,
          });
          totPaid += calc.paidHours;
          totOT += calc.overtimeHours;
          totShortage += calc.shortageHours;
          totPay += calc.netDailyPay;
        } catch {}
      }

      rowsData.push([
        dateStr,
        dayName,
        `"${site?.name || ''}"`,
        startTimeStr,
        offTimeStr,
        calc?.elapsedHours ?? '-',
        calc?.unpaidBreakHours ?? '-',
        calc?.paidHours ?? '-',
        calc?.regularHours ?? '-',
        calc?.overtimeHours ?? 0,
        calc?.shortageHours ?? 0,
        calc?.netDailyPay ?? '-',
        offEvt ? (calc?.overtimeHours > 0 ? 'Overtime Shift' : 'Standard Shift') : 'Incomplete (Missing OFF)',
      ]);
    });

    // Build structured individual CSV
    const csvLines = [
      `"CNW ENGINEERING (PVT) LTD — INDIVIDUAL ATTENDANCE & PAYROLL REPORT"`,
      `"Employee: ${emp.fullName} (${emp.employeeCode})"`,
      `"Calling Name: ${emp.callingName}"`,
      `"Designation: ${emp.designation}"`,
      `"Daily Salary Rate: LKR ${emp.currentDailyRate.toFixed(2)}"`,
      `"Overtime (OT) Rate: LKR ${emp.currentOtRate.toFixed(2)} / hour"`,
      `"Billing Period: ${selectedMonthForReport}"`,
      `""`,
      `"Date","Day","Site Name","START Time","OFF Time","Elapsed Hours","Unpaid Break (h)","Paid Hours","Regular Hours","OT Hours","Shortage Hours","Daily Payable (LKR)","Shift Status"`,
      ...rowsData.map((r) => r.join(',')),
      `""`,
      `"MONTHLY TOTALS SUMMARY:"`,
      `"Total Days Worked",${rowsData.length}`,
      `"Total Paid Hours",${totPaid.toFixed(2)}`,
      `"Total Overtime (OT) Hours",${totOT.toFixed(2)}`,
      `"Total Shortage Hours",${totShortage.toFixed(2)}`,
      `"TOTAL NET PAYABLE (LKR)",${totPay.toFixed(2)}`,
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CNW_Attendance_${emp.employeeCode}_${selectedMonthForReport}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Official Logo in crisp white background */}
            <div className="w-14 h-14 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-md overflow-hidden border border-slate-200 shrink-0">
              <img src="/cnw-logo.jpg" alt="CNW Logo" className="w-full h-full object-contain" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-[#02353C] text-[#C1F6ED] rounded-full text-xs font-bold tracking-wide">
                  {currentRole} PORTAL
                </span>
                <span className="text-xs text-slate-500 font-medium">Asia/Colombo (UTC+05:30)</span>
              </div>
              <h1 className="text-2xl font-black text-[#02353C] mt-0.5">CNW Workforce Management</h1>
              <p className="text-xs text-slate-500">
                {currentRole === 'CEO' && 'Executive overview & payroll approval for Mr. Jayantha Weerathunga'}
                {currentRole === 'HR_MANAGER' && 'Workforce records, site management, attendance tracking & payroll'}
                {currentRole === 'SYSTEM_ADMIN' && 'System configuration, account provisioning & device audit'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
            {/* Quick tab switcher */}
            <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'overview' ? 'bg-white text-[#02353C] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('employees')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'employees' ? 'bg-white text-[#02353C] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Employees & Sites
              </button>
              {currentRole !== 'SYSTEM_ADMIN' && (
                <button
                  onClick={() => setActiveTab('payroll')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'payroll' ? 'bg-white text-[#02353C] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Payroll & Approvals
                </button>
              )}
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors"
                title="Sign out"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Active Workforce</p>
              <h3 className="text-2xl font-black text-[#02353C] mt-1">{employees.length}</h3>
              <p className="text-[11px] text-emerald-600 font-medium">100% Registered</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#2EAF7D] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Construction Sites</p>
              <h3 className="text-2xl font-black text-[#02353C] mt-1">{sites.length}</h3>
              <p className="text-[11px] text-slate-500 font-medium">Active locations</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          {currentRole !== 'SYSTEM_ADMIN' ? (
            <>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Total OT Recorded</p>
                  <h3 className="text-2xl font-black text-[#02353C] mt-1">{totalOTHours} hrs</h3>
                  <p className="text-[11px] text-amber-600 font-medium">All hours past 5:00 PM</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Daily Payable</p>
                  <h3 className="text-2xl font-black text-emerald-700 mt-1">Rs. {totalPayable.toLocaleString()}</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Shortage: Rs. {totalDeductions}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 bg-slate-100 p-5 rounded-2xl border border-slate-200 flex items-center gap-3 text-slate-600 text-xs">
              <ShieldCheck className="w-5 h-5 text-slate-500 shrink-0" />
              <span>
                <strong>Salary Data Restricted:</strong> System Administrator account does not have access to salary & payroll details by policy.
              </span>
            </div>
          )}
        </div>

        {/* Tab: Overview / Attendance Stream */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-[#02353C]">Real-Time Attendance Audit Log</h3>
                <p className="text-xs text-slate-500">Append-only attendance events stream</p>
              </div>
            </div>

            {attendanceEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No attendance events logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Site</th>
                      <th className="py-3 px-4">Effective Time</th>
                      <th className="py-3 px-4">Adjustment Audit</th>
                      <th className="py-3 px-4">Sync Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {[...attendanceEvents].reverse().map((evt) => {
                      const site = sites.find((s) => s.id === evt.siteId);
                      return (
                        <tr key={evt.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                evt.eventType === 'START'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : evt.eventType === 'MOVE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {evt.eventType}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">{site?.name}</td>
                          <td className="py-3 px-4 font-bold text-[#02353C]">
                            {new Date(evt.effectiveEventTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            {evt.wasTimeAdjusted ? (
                              <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Changed: {evt.adjustmentReason}
                              </span>
                            ) : (
                              <span className="text-slate-400">Auto-filled</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {evt.isOfflineCreated ? (
                              <span className="text-amber-600 font-semibold">Synced from offline queue</span>
                            ) : (
                              <span className="text-emerald-600 font-semibold">Direct Online</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Employees & Sites (Full HR CRUD) */}
        {activeTab === 'employees' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employees */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-[#02353C]">Workforce Directory</h3>
                  <p className="text-xs text-slate-500">10–15 Employees</p>
                </div>
                {currentRole === 'HR_MANAGER' && (
                  <button
                    onClick={() => {
                      setEditingEmp(null);
                      setEmpForm({
                        code: `CNW-E0${employees.length + 1}`,
                        fullName: '',
                        callingName: '',
                        phone: '',
                        designation: 'Site Worker',
                        dailyRate: 2000,
                        otRate: 300,
                      });
                      setEmpModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-[#02353C] hover:bg-[#03444d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#3FD0C9]" /> Add Employee
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{emp.fullName} ({emp.callingName})</p>
                      <p className="text-xs text-slate-500">{emp.employeeCode} &bull; {emp.designation}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {currentRole !== 'SYSTEM_ADMIN' && (
                        <div className="text-right">
                          <p className="text-xs font-bold text-emerald-700">Rs. {emp.currentDailyRate.toLocaleString()} / day</p>
                          <p className="text-[11px] text-slate-500">OT: Rs. {emp.currentOtRate}/hr</p>
                        </div>
                      )}

                      {currentRole === 'HR_MANAGER' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingEmp(emp);
                              setEmpForm({
                                code: emp.employeeCode,
                                fullName: emp.fullName,
                                callingName: emp.callingName,
                                phone: emp.phone || '',
                                designation: emp.designation,
                                dailyRate: emp.currentDailyRate,
                                otRate: emp.currentOtRate,
                              });
                              setEmpModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Edit Employee"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteEmployee && employees.length > 1 && (
                            <button
                              onClick={() => onDeleteEmployee(emp.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Employee"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sites */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-[#02353C]">Construction Sites</h3>
                  <p className="text-xs text-slate-500">Active project locations</p>
                </div>
                {currentRole === 'HR_MANAGER' && (
                  <button
                    onClick={() => {
                      setEditingSite(null);
                      setSiteForm({
                        siteCode: `CNW-S0${sites.length + 1}`,
                        name: '',
                        location: '',
                        address: '',
                      });
                      setSiteModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-[#02353C] hover:bg-[#03444d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#3FD0C9]" /> Add Site
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {sites.map((site) => (
                  <div
                    key={site.id}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{site.name}</p>
                      <p className="text-xs text-slate-500">{site.location} &bull; {site.siteCode}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ACTIVE
                      </span>

                      {currentRole === 'HR_MANAGER' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingSite(site);
                              setSiteForm({
                                siteCode: site.siteCode,
                                name: site.name,
                                location: site.location,
                                address: site.address || '',
                              });
                              setSiteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Edit Site"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteSite && sites.length > 1 && (
                            <button
                              onClick={() => onDeleteSite(site.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Site"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Payroll & Approval */}
        {activeTab === 'payroll' && currentRole !== 'SYSTEM_ADMIN' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#02353C]">Daily & Monthly Payroll</h3>
                <p className="text-xs text-slate-500">Calculated strictly according to CNW rules confirmed by owner</p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                    payrollStatus === 'DRAFT'
                      ? 'bg-slate-100 text-slate-700 border border-slate-300'
                      : payrollStatus === 'SUBMITTED'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : payrollStatus === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {payrollStatus}
                </span>
              </div>
            </div>

            {/* Calculations Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Employee</th>
                    <th className="py-3 px-3">Shift (START &rarr; OFF)</th>
                    <th className="py-3 px-3">Elapsed</th>
                    <th className="py-3 px-3">Unpaid Lunch</th>
                    <th className="py-3 px-3">Paid Hours</th>
                    <th className="py-3 px-3">OT (hrs)</th>
                    <th className="py-3 px-3">Shortage</th>
                    <th className="py-3 px-3">Base</th>
                    <th className="py-3 px-3">Net Daily Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {dailyPayrolls.map((row) => (
                    <tr key={row.sessionGroupId} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 font-bold text-slate-800">{row.employee.callingName}</td>
                      <td className="py-3 px-3">
                        {row.isMissingOff ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Missing OFF
                          </span>
                        ) : (
                          `${new Date(row.startEvt!.effectiveEventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${new Date(row.offEvt!.effectiveEventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        )}
                      </td>
                      <td className="py-3 px-3">{row.calc?.elapsedHours ?? '-'} h</td>
                      <td className="py-3 px-3">{row.calc?.unpaidBreakHours ?? '-'} h</td>
                      <td className="py-3 px-3 font-bold text-[#02353C]">{row.calc?.paidHours ?? '-'} h</td>
                      <td className="py-3 px-3 text-amber-700 font-bold">{row.calc?.overtimeHours ?? 0} h</td>
                      <td className="py-3 px-3 text-rose-600">
                        {row.calc?.shortageHours ? `-${row.calc.shortageHours}h (Rs. ${row.calc.shortageDeduction})` : '0'}
                      </td>
                      <td className="py-3 px-3">Rs. {row.calc?.basePay ?? row.employee.currentDailyRate}</td>
                      <td className="py-3 px-3 font-black text-emerald-700">
                        Rs. {row.calc?.netDailyPay.toLocaleString() ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Approval Workflow Controls & Google Sheets integration */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-slate-300"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export CSV
                </button>

                <a
                  href="https://docs.google.com/spreadsheets/d/1AFXJ4m4aws1-s9mUbdf_UxrMmN_4xyJJIjo17RikV1c/edit?usp=sharing"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-emerald-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Open CNW Google Sheet</span>
                </a>
              </div>

              {/* HR Actions */}
              {currentRole === 'HR_MANAGER' && payrollStatus === 'DRAFT' && (
                <button
                  onClick={() => setPayrollStatus('SUBMITTED')}
                  className="px-5 py-2.5 bg-[#02353C] hover:bg-[#03444d] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md"
                >
                  <Send className="w-4 h-4 text-[#3FD0C9]" /> Submit to CEO for Approval
                </button>
              )}

              {/* CEO Actions (Mr. Jayantha Weerathunga) */}
              {currentRole === 'CEO' && payrollStatus === 'SUBMITTED' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRejectBox(true)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-rose-300"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" /> Reject
                  </button>
                  <button
                    onClick={() => setPayrollStatus('APPROVED')}
                    className="px-5 py-2.5 bg-[#2EAF7D] hover:bg-[#259b6c] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <CheckCircle className="w-4 h-4 text-white" /> Approve Payroll
                  </button>
                </div>
              )}

              {payrollStatus === 'APPROVED' && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Officially Finalized & Approved by CEO Mr. Jayantha Weerathunga
                </div>
              )}
            </div>

            {/* Rejection input box */}
            {showRejectBox && currentRole === 'CEO' && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-rose-900">
                  Mandatory CEO Rejection Reason:
                </label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Overtime hours for Kamal Perera need site verification"
                  className="w-full p-2.5 bg-white border border-rose-300 rounded-lg text-xs"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowRejectBox(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (rejectReason.trim()) {
                        setPayrollStatus('REJECTED');
                        setShowRejectBox(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-lg"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}

            {/* SPECIAL HR OPTION: Dedicated Individual Employee Monthly CSV Download */}
            {currentRole === 'HR_MANAGER' && (
              <div className="pt-6 border-t border-slate-200">
                <div className="p-5 bg-gradient-to-br from-slate-50 to-emerald-50/40 rounded-2xl border border-emerald-200/80 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-[#02353C] flex items-center gap-2">
                      <Download className="w-4 h-4 text-[#2EAF7D]" />
                      Download Individual Employee Monthly Attendance (Structured CSV)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Generate and download an official attendance record containing only the selected employee's shifts, hours, and pay breakdown for any specific month.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Select Employee (ID / Name)
                      </label>
                      <select
                        value={selectedEmpForReport}
                        onChange={(e) => setSelectedEmpForReport(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2EAF7D]"
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.fullName} ({emp.employeeCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Billing Month (YYYY-MM)
                      </label>
                      <input
                        type="month"
                        value={selectedMonthForReport}
                        onChange={(e) => setSelectedMonthForReport(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2EAF7D]"
                      />
                    </div>

                    <div>
                      <button
                        onClick={handleDownloadSingleEmployeeReport}
                        className="w-full py-2.5 px-4 bg-[#02353C] hover:bg-[#03444d] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        <Download className="w-4 h-4 text-[#3FD0C9]" />
                        <span>Download Employee CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Employee Modal (Add / Edit) */}
      {empModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-[#02353C]">
              {editingEmp ? 'Edit Employee Profile' : 'Add New Employee'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employee Code</label>
                <input
                  type="text"
                  value={empForm.code}
                  onChange={(e) => setEmpForm({ ...empForm, code: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={empForm.fullName}
                    onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })}
                    placeholder="e.g. Sunil Perera"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Calling Name</label>
                  <input
                    type="text"
                    value={empForm.callingName}
                    onChange={(e) => setEmpForm({ ...empForm, callingName: e.target.value })}
                    placeholder="e.g. Sunil"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                  <input
                    type="text"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    placeholder="+9477..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Designation</label>
                  <input
                    type="text"
                    value={empForm.designation}
                    onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                    placeholder="Mason, Carpenter..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Daily Salary (LKR)</label>
                  <input
                    type="number"
                    value={empForm.dailyRate}
                    onChange={(e) => setEmpForm({ ...empForm, dailyRate: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">OT Rate / Hr (LKR)</label>
                  <input
                    type="number"
                    value={empForm.otRate}
                    onChange={(e) => setEmpForm({ ...empForm, otRate: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-emerald-700"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setEmpModalOpen(false)}
                className="py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployee}
                className="py-2.5 rounded-xl font-bold text-white bg-[#02353C] hover:bg-[#03444d]"
              >
                Save Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Site Modal (Add / Edit) */}
      {siteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-[#02353C]">
              {editingSite ? 'Edit Construction Site' : 'Add Construction Site'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Site Code</label>
                <input
                  type="text"
                  value={siteForm.siteCode}
                  onChange={(e) => setSiteForm({ ...siteForm, siteCode: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Site Name</label>
                <input
                  type="text"
                  value={siteForm.name}
                  onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                  placeholder="e.g. Colombo High-Rise"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Location / Area</label>
                  <input
                    type="text"
                    value={siteForm.location}
                    onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })}
                    placeholder="e.g. Colombo 03"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    value={siteForm.address}
                    onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                    placeholder="Road/Street"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setSiteModalOpen(false)}
                className="py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSite}
                className="py-2.5 rounded-xl font-bold text-white bg-[#02353C] hover:bg-[#03444d]"
              >
                Save Site
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
