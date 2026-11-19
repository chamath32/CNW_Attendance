import React, { useState, useEffect } from 'react';
import { Employee, Site, AttendanceEvent, EventType } from '../types';
import { TimeAdjustmentModal } from './TimeAdjustmentModal';
import { validateAttendanceEvent } from '../lib/attendance-validator';
import { queueOfflineEvent } from '../lib/offline-db';
import {
  PlayCircle,
  Truck,
  StopCircle,
  MapPin,
  Clock,
  Wifi,
  WifiOff,
  UserCheck,
  AlertTriangle,
  History,
  User as UserIcon,
  Home as HomeIcon,
  CheckCircle2,
  LogOut,
} from 'lucide-react';

interface EmployeeDashboardProps {
  employee: Employee;
  sites: Site[];
  events: AttendanceEvent[];
  onAddEvent: (event: AttendanceEvent) => Promise<void>;
  onCorrectOff: (sessionGroupId: string, newOffDate: string, newOffTime: string, reason: string) => Promise<void>;
  onLogout?: () => void;
}

/**
 * Get Sri Lankan Local Date and Time
 */
export function getSriLankanLocalDateTime(): { dateStr: string; timeStr: string } {
  const now = new Date();
  const slOffsetMs = 5.5 * 60 * 60 * 1000;
  const slDate = new Date(now.getTime() + slOffsetMs);
  const dateStr = slDate.toISOString().split('T')[0];
  const hours = slDate.getUTCHours().toString().padStart(2, '0');
  const mins = slDate.getUTCMinutes().toString().padStart(2, '0');
  return { dateStr, timeStr: `${hours}:${mins}` };
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  employee,
  sites,
  events,
  onAddEvent,
  onCorrectOff,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'profile'>('home');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Modal state with both Date and Time
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<EventType>('START');
  const [selectedSiteId, setSelectedSiteId] = useState<string>(sites[0]?.id || '');
  const [modalAutoDate, setModalAutoDate] = useState<string>(() => getSriLankanLocalDateTime().dateStr);
  const [modalAutoTime, setModalAutoTime] = useState<string>(() => getSriLankanLocalDateTime().timeStr);
  const [validationError, setValidationError] = useState<string | null>(null);

  // OFF Correction state
  const [correctModalOpen, setCorrectModalOpen] = useState<boolean>(false);
  const [extendOffDate, setExtendOffDate] = useState<string>(() => getSriLankanLocalDateTime().dateStr);
  const [extendOffTime, setExtendOffTime] = useState<string>('21:30');
  const [extendReason, setExtendReason] = useState<string>('Supervisor requested urgent shift overtime extension');

  // Network listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Compute active session from employee events
  const employeeEvents = events.filter((e) => e.employeeId === employee.id);
  const lastEvent = employeeEvents[employeeEvents.length - 1];

  const isWorking = lastEvent && lastEvent.eventType !== 'OFF';
  const currentSite = sites.find((s) => s.id === lastEvent?.siteId) || sites[0];

  // Find start event of current active session
  const currentStartEvent = isWorking
    ? [...employeeEvents].reverse().find((e) => e.eventType === 'START')
    : null;

  // Live work duration timer
  const [durationStr, setDurationStr] = useState<string>('0h 00m');
  useEffect(() => {
    if (!isWorking || !currentStartEvent) {
      setDurationStr('0h 00m');
      return;
    }
    const updateTimer = () => {
      const startMs = new Date(currentStartEvent.effectiveEventTime).getTime();
      const diffMs = Math.max(0, Date.now() - startMs);
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setDurationStr(`${hours}h ${mins < 10 ? '0' : ''}${mins}m`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [isWorking, currentStartEvent]);

  // Handle Button Click (START, MOVING, END/OFF)
  const handleOpenActionModal = (type: EventType) => {
    setValidationError(null);
    setActiveAction(type);

    // Capture exact current Sri Lankan date and time
    const live = getSriLankanLocalDateTime();
    setModalAutoDate(live.dateStr);
    setModalAutoTime(live.timeStr);

    if (type === 'MOVE' && currentSite) {
      const otherSite = sites.find((s) => s.id !== currentSite.id) || sites[0];
      setSelectedSiteId(otherSite?.id || '');
    } else {
      setSelectedSiteId(currentSite?.id || sites[0]?.id || '');
    }

    setModalOpen(true);
  };

  // Submit attendance from modal with both Date and Time
  const handleConfirmAction = async (
    effectiveDateYYYYMMDD: string,
    effectiveTimeHHMM: string,
    wasAdjusted: boolean,
    adjustmentReason?: string
  ) => {
    // Construct local timestamp in Asia/Colombo (+05:30)
    const effectiveISO = new Date(`${effectiveDateYYYYMMDD}T${effectiveTimeHHMM}:00+05:30`).toISOString();
    const nowISO = new Date().toISOString();

    // Find preceding valid OFF if starting
    const prevOff = [...employeeEvents].reverse().find((e) => e.eventType === 'OFF');

    // Run client-side validation using full date + time ISO
    const validation = validateAttendanceEvent({
      eventType: activeAction,
      newTimeISO: effectiveISO,
      currentTimeISO: nowISO,
      currentWorkingStatus: isWorking ? 'WORKING' : 'IDLE',
      currentSessionStart: currentStartEvent,
      previousSessionOff: prevOff,
    });

    if (!validation.isValid) {
      setValidationError(validation.errorMessage || 'Validation error');
      return;
    }

    const sessionGroupId =
      activeAction === 'START'
        ? `sess-${Date.now()}`
        : currentStartEvent?.sessionGroupId || `sess-${Date.now()}`;

    const selectedSite = sites.find((s) => s.id === selectedSiteId);

    const newEvent: AttendanceEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sessionGroupId,
      employeeId: employee.id,
      siteId: selectedSiteId,
      employeeName: employee.fullName,
      siteName: selectedSite?.name || 'CNW Site',
      eventType: activeAction,
      deviceTimestamp: nowISO,
      isOfflineCreated: !isOnline,
      rawPopulatedTime: `${modalAutoDate}T${modalAutoTime}:00+05:30`,
      effectiveEventTime: effectiveISO,
      wasTimeAdjusted: wasAdjusted,
      adjustmentReason: wasAdjusted ? adjustmentReason : undefined,
      createdUserId: employee.userId,
      createdAt: nowISO,
    };

    if (!isOnline) {
      await queueOfflineEvent(newEvent);
      setPendingSyncCount((prev) => prev + 1);
    }

    await onAddEvent(newEvent);
    setModalOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 max-w-md mx-auto relative shadow-2xl">
      {/* Top App Header with Official Company Logo in crisp white card */}
      <header className="bg-[#02353C] text-white px-5 pt-5 pb-5 rounded-b-3xl shadow-lg border-b border-[#03444d]">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shadow-md overflow-hidden shrink-0 border border-white/20">
              <img src="/cnw-logo.jpg" alt="CNW Logo" className="w-full h-full object-contain" />
            </div>

            <div>
              <h1 className="font-extrabold text-base leading-tight tracking-tight">{employee.fullName}</h1>
              <p className="text-xs text-[#C1F6ED] flex items-center gap-1 font-semibold">
                <UserCheck className="w-3.5 h-3.5 text-[#3FD0C9]" />
                {employee.employeeCode} &bull; {employee.designation}
              </p>
            </div>
          </div>

          {/* Sync & Connectivity Pill + Logout */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                isOnline
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3 text-amber-400" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Log out"
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sync Status Banner */}
        <div className="mt-2 text-center text-xs py-1.5 px-3 rounded-xl bg-black/25 backdrop-blur-sm border border-white/10 font-medium">
          {pendingSyncCount > 0 ? (
            <span className="text-amber-300 font-bold tracking-wide">
              SAVED ON DEVICE – NOT YET SYNCED ({pendingSyncCount})
            </span>
          ) : (
            <span className="text-[#C1F6ED] flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3FD0C9]" />
              SYNCHRONIZED SUCCESSFULLY
            </span>
          )}
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 p-5 pb-24 space-y-5">
        {activeTab === 'home' && (
          <>
            {/* Status Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Current Status / වත්මන් තත්වය
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                    isWorking
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                      : 'bg-slate-100 text-slate-600 border border-slate-300'
                  }`}
                >
                  {isWorking ? 'WORKING NOW / වැඩ කරමින්' : 'OFF DUTY / විවේකයෙන්'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#2EAF7D]" /> Current Site
                  </span>
                  <p className="font-bold text-sm text-[#02353C] truncate mt-0.5">
                    {isWorking ? currentSite?.name : 'None'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#2EAF7D]" /> Session Duration
                  </span>
                  <p className="font-extrabold text-sm text-[#02353C] mt-0.5">{durationStr}</p>
                </div>
              </div>
            </div>

            {/* Validation Error banner if any */}
            {validationError && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* THREE PROMINENT BILINGUAL BUTTONS */}
            <div className="space-y-3.5 pt-2">
              {/* 1. START Button: GREEN */}
              <button
                disabled={isWorking}
                onClick={() => handleOpenActionModal('START')}
                className={`w-full py-5 px-6 rounded-2xl flex items-center justify-between shadow-md transition-all active:scale-[0.98] ${
                  isWorking
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-[#2EAF7D] text-white hover:bg-[#259b6c] active:bg-[#1e7c57] ring-4 ring-[#2EAF7D]/20 shadow-emerald-700/20'
                }`}
              >
                <div className="text-left">
                  <div className="text-2xl font-black tracking-wide">START</div>
                  <div className="sinhala-text text-base font-bold opacity-95">වැඩ ආරම්භ කරන්න</div>
                </div>
                <PlayCircle className="w-10 h-10 opacity-90" />
              </button>

              {/* 2. MOVING Button: LIGHT PURPLE */}
              <button
                disabled={!isWorking}
                onClick={() => handleOpenActionModal('MOVE')}
                className={`w-full py-5 px-6 rounded-2xl flex items-center justify-between shadow-md transition-all active:scale-[0.98] ${
                  !isWorking
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:bg-[#6D28D9] ring-4 ring-[#8B5CF6]/30 shadow-purple-900/20'
                }`}
              >
                <div className="text-left">
                  <div className="text-2xl font-black tracking-wide">MOVING</div>
                  <div className="sinhala-text text-base font-bold text-white/95">ස්ථානය මාරු කරන්න</div>
                </div>
                <Truck className="w-10 h-10 text-white/90" />
              </button>

              {/* 3. END / OFF Button: LIGHT RED */}
              <button
                disabled={!isWorking}
                onClick={() => handleOpenActionModal('OFF')}
                className={`w-full py-5 px-6 rounded-2xl flex items-center justify-between shadow-md transition-all active:scale-[0.98] ${
                  !isWorking
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-[#F87171] text-white hover:bg-[#EF4444] active:bg-[#DC2626] ring-4 ring-[#F87171]/30 shadow-red-500/20'
                }`}
              >
                <div className="text-left">
                  <div className="text-2xl font-black tracking-wide">END / OFF</div>
                  <div className="sinhala-text text-base font-bold opacity-95">වැඩ අවසන් කරන්න</div>
                </div>
                <StopCircle className="w-10 h-10 opacity-90" />
              </button>
            </div>

            {/* Discreet past OFF correction link (Rare functionality - kept compact) */}
            {!isWorking && employeeEvents.length > 0 && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => {
                    const live = getSriLankanLocalDateTime();
                    setExtendOffDate(live.dateStr);
                    setCorrectModalOpen(true);
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline decoration-dotted transition-colors inline-flex items-center gap-1 py-1 px-2"
                >
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Adjust past OFF time (Extended shift)</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Tab: History */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-[#02353C] flex items-center gap-2">
              <History className="w-4 h-4 text-[#2EAF7D]" />
              Attendance History / පැමිණීමේ ඉතිහාසය
            </h2>
            {employeeEvents.length === 0 ? (
              <div className="bg-white p-8 text-center rounded-2xl text-slate-400 text-sm border border-slate-200">
                No attendance recorded yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {[...employeeEvents].reverse().map((evt) => {
                  const site = sites.find((s) => s.id === evt.siteId);
                  const date = new Date(evt.effectiveEventTime).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  });
                  const time = new Date(evt.effectiveEventTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      key={evt.id}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-black ${
                              evt.eventType === 'START'
                                ? 'bg-emerald-100 text-emerald-800'
                                : evt.eventType === 'MOVE'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {evt.eventType}
                          </span>
                          <span className="text-xs font-bold text-slate-700">{site?.name}</span>
                        </div>
                        {evt.wasTimeAdjusted && (
                          <p className="text-[10px] text-amber-700 font-medium mt-1">
                            Adjusted: {evt.adjustmentReason}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">{date}</span>
                        <span className="text-sm font-extrabold text-[#02353C]">{time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Profile */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-[#02353C] flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-[#2EAF7D]" />
              Employee Profile
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Employee ID</span>
                <span className="font-semibold">{employee.employeeCode}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Full Name</span>
                <span className="font-semibold">{employee.fullName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Designation</span>
                <span className="font-semibold">{employee.designation}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Daily Salary Rate</span>
                <span className="font-bold text-emerald-700">Rs. {employee.currentDailyRate.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Overtime Rate</span>
                <span className="font-bold text-emerald-700">Rs. {employee.currentOtRate.toLocaleString()} / hr</span>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out of this Phone</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 px-6 py-2.5 flex justify-around shadow-lg">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'home' ? 'text-[#2EAF7D] font-bold' : 'text-slate-400'
          }`}
        >
          <HomeIcon className="w-5 h-5" />
          <span className="text-[11px]">Home</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'history' ? 'text-[#2EAF7D] font-bold' : 'text-slate-400'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[11px]">History</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'profile' ? 'text-[#2EAF7D] font-bold' : 'text-slate-400'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[11px]">Profile</span>
        </button>
      </nav>

      {/* Time Adjustment Modal with Date + Time */}
      <TimeAdjustmentModal
        key={activeAction + modalAutoDate + modalAutoTime + (modalOpen ? '1' : '0')}
        isOpen={modalOpen}
        eventType={activeAction}
        sites={sites}
        selectedSiteId={selectedSiteId}
        onSelectSiteId={setSelectedSiteId}
        autoDate={modalAutoDate}
        autoTime={modalAutoTime}
        onSubmit={handleConfirmAction}
        onCancel={() => setModalOpen(false)}
      />

      {/* Past OFF Correction Modal */}
      {correctModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Extend / Adjust Last OFF Record
            </h3>
            <p className="text-xs text-slate-500">
              If supervisor requested you to continue working after your initial OFF tap, update the effective finish date and time:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Finish Date
                </label>
                <input
                  type="date"
                  value={extendOffDate}
                  onChange={(e) => setExtendOffDate(e.target.value)}
                  className="w-full text-sm font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Finish Time
                </label>
                <input
                  type="time"
                  value={extendOffTime}
                  onChange={(e) => setExtendOffTime(e.target.value)}
                  className="w-full text-sm font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Reason for Extension *
              </label>
              <input
                type="text"
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setCorrectModalOpen(false)}
                className="py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const lastOff = [...employeeEvents].reverse().find((e) => e.eventType === 'OFF');
                  if (lastOff) {
                    await onCorrectOff(lastOff.sessionGroupId, extendOffDate, extendOffTime, extendReason);
                  }
                  setCorrectModalOpen(false);
                }}
                className="py-2.5 rounded-xl font-bold text-white bg-[#02353C] hover:bg-[#03444d]"
              >
                Apply Extension
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
