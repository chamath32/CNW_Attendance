import { DailyPayrollCalculation } from '../types';

export interface PayrollParams {
  sessionGroupId: string;
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  startTime: string; // ISO string
  offTime: string;   // ISO string
  dailyRate: number;
  otRate: number;
  unpaidBreakHours?: number; // Standard 1.0 hr (12 PM - 1 PM)
  normalWorkHours?: number;  // Standard 8.0 hrs
}

/**
 * Round a number to two decimal places
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Get fractional hour of day in Sri Lanka timezone (UTC+05:30)
 */
function getSriLankanDecimalHour(date: Date): number {
  // Convert UTC timestamp to Sri Lanka (UTC+5.5 hours)
  const utcMs = date.getTime();
  const slOffsetMs = 5.5 * 60 * 60 * 1000;
  const slDate = new Date(utcMs + slOffsetMs);
  return slDate.getUTCHours() + slDate.getUTCMinutes() / 60;
}

/**
 * Determine if a shift spans across the standard lunch break window (12:00 PM - 1:00 PM).
 * If a shift ends before/at 12:00 PM (morning half-day) or starts at/after 1:00 PM (afternoon half-day),
 * no lunch break deduction applies.
 */
export function determineBreakDeduction(start: Date, off: Date, standardBreakHours: number = 1.0): number {
  const elapsedMillis = off.getTime() - start.getTime();
  const isMultiDay = elapsedMillis > 16 * 60 * 60 * 1000;

  if (isMultiDay) {
    return standardBreakHours;
  }

  const startHourSL = getSriLankanDecimalHour(start);
  const offHourSL = getSriLankanDecimalHour(off);

  // Morning half-day: starts in morning and ends at or before 12:15 PM
  if (startHourSL < 12.0 && offHourSL <= 12.25) {
    return 0.0;
  }

  // Afternoon half-day: starts at or after 12:75 PM / 1:00 PM
  if (startHourSL >= 12.75 && offHourSL > 12.75) {
    return 0.0;
  }

  // Shift crosses lunch break window
  return standardBreakHours;
}

/**
 * Calculate daily working hours and payroll strictly according to CNW rules confirmed by owner:
 * 1. Normal shift: 8:00 AM to 5:00 PM with 12 PM - 1 PM lunch break (8 paid hours).
 * 2. Half-day: Ending before 12 PM or starting after 1 PM has 0 lunch deduction (4 paid hours).
 * 3. All hours worked past 5:00 PM (including continuous overnight shifts) are counted as Overtime at the hourly OT rate.
 */
export function calculateDailyPayroll(params: PayrollParams): DailyPayrollCalculation {
  const {
    sessionGroupId,
    employeeId,
    workDate,
    startTime,
    offTime,
    dailyRate,
    otRate,
    unpaidBreakHours = 1.0,
    normalWorkHours = 8.0,
  } = params;

  const startDate = new Date(startTime);
  const offDate = new Date(offTime);

  const startMs = startDate.getTime();
  const offMs = offDate.getTime();

  if (isNaN(startMs) || isNaN(offMs)) {
    throw new Error('Invalid start or off time provided to calculateDailyPayroll');
  }

  if (offMs < startMs) {
    throw new Error('OFF time cannot be earlier than START time');
  }

  // Elapsed hours between START and OFF
  const elapsedMillis = offMs - startMs;
  const elapsedHours = round2(elapsedMillis / (1000 * 60 * 60));

  // Determine applicable unpaid break deduction
  const applicableBreak = determineBreakDeduction(startDate, offDate, unpaidBreakHours);

  // Paid hours after deducting applicable break
  const paidHours = round2(Math.max(0, elapsedHours - applicableBreak));

  // Overtime: any hours in excess of normal paid work hours (8.0 hours)
  const overtimeHours = round2(Math.max(0, paidHours - normalWorkHours));

  // Shortage: hours under normal paid work hours (e.g. half-day shortage = 4 hours)
  const shortageHours = round2(Math.max(0, normalWorkHours - paidHours));

  // Overtime pay (LKR) = overtime_hours * otRate
  const overtimePay = round2(overtimeHours * otRate);

  // Shortage deduction (LKR) = shortage_hours * otRate
  const shortageDeduction = round2(shortageHours * otRate);

  // Base daily salary
  const basePay = dailyRate;

  // Daily payable = daily_salary + overtime_pay - shortage_deduction
  const netDailyPay = round2(basePay + overtimePay - shortageDeduction);

  const regularHours = round2(Math.min(normalWorkHours, paidHours));

  return {
    sessionGroupId,
    employeeId,
    workDate,
    startTime,
    offTime,
    elapsedHours,
    unpaidBreakHours: applicableBreak,
    paidHours,
    regularHours,
    overtimeHours,
    shortageHours,
    dailyRateApplied: dailyRate,
    otRateApplied: otRate,
    basePay,
    overtimePay,
    shortageDeduction,
    netDailyPay,
    isMissingOff: false,
  };
}
