export type UserRole = 'EMPLOYEE' | 'HR_MANAGER' | 'CEO' | 'SYSTEM_ADMIN';

export type EventType = 'START' | 'MOVE' | 'OFF';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  fullName: string;
  email?: string;
  phone?: string;
  isActive: boolean;
}

export interface Employee {
  id: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  callingName: string;
  nicNumber?: string;
  phone?: string;
  designation: string;
  currentDailyRate: number;
  currentOtRate: number;
  isActive: boolean;
}

export interface Site {
  id: string;
  siteCode: string;
  name: string;
  location: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  isActive: boolean;
}

export interface AttendanceEvent {
  id: string;
  sessionGroupId: string;
  employeeId: string;
  siteId: string;
  employeeName?: string;
  siteName?: string;
  eventType: EventType;
  deviceTimestamp: string;     // ISO-8601 UTC
  serverTimestamp?: string;
  isOfflineCreated: boolean;
  syncedAt?: string;
  rawPopulatedTime: string;    // The initial auto-filled time
  effectiveEventTime: string;  // The user-confirmed or corrected time
  wasTimeAdjusted: boolean;
  adjustmentReason?: string;
  createdUserId: string;
  createdAt: string;
}

export interface DailyPayrollCalculation {
  sessionGroupId: string;
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  startTime: string; // ISO
  offTime: string;   // ISO
  elapsedHours: number;
  unpaidBreakHours: number;
  paidHours: number;
  regularHours: number;
  overtimeHours: number;
  shortageHours: number;
  dailyRateApplied: number;
  otRateApplied: number;
  basePay: number;
  overtimePay: number;
  shortageDeduction: number;
  netDailyPay: number;
  isMissingOff: boolean;
}

export interface AttendanceState {
  currentSessionGroupId: string | null;
  currentStatus: 'IDLE' | 'WORKING';
  currentSiteId: string | null;
  currentSiteName: string | null;
  startTime: string | null;
  lastEventTime: string | null;
  lastEventType: EventType | null;
}
