import { describe, it, expect } from 'vitest';
import { calculateDailyPayroll } from '../src/lib/payroll';

describe('CNW Workforce — Payroll Engine (Owner Policy Verification)', () => {
  const baseParams = {
    sessionGroupId: 'sess-001',
    employeeId: 'emp-001',
    workDate: '2026-11-18',
    dailyRate: 2000, // Rs. 2,000 / day
    otRate: 300,     // Rs. 300 / hr OT
    unpaidBreakHours: 1.0,
    normalWorkHours: 8.0,
  };

  it('Example 1: Standard Full Day: 8:00 AM – 5:00 PM (8 paid hours, 0 OT -> Rs. 2,000)', () => {
    const result = calculateDailyPayroll({
      ...baseParams,
      startTime: '2026-11-18T08:00:00+05:30',
      offTime: '2026-11-18T17:00:00+05:30', // 9 hours elapsed - 1 hr break = 8 paid hours
    });

    expect(result.elapsedHours).toBe(9);
    expect(result.unpaidBreakHours).toBe(1);
    expect(result.paidHours).toBe(8);
    expect(result.overtimeHours).toBe(0);
    expect(result.shortageHours).toBe(0);
    expect(result.netDailyPay).toBe(2000);
  });

  it('Example 2: Overtime Day: 8:00 AM – 7:00 PM (10 paid hours, 2 OT -> Rs. 2,600)', () => {
    const result = calculateDailyPayroll({
      ...baseParams,
      startTime: '2026-11-18T08:00:00+05:30',
      offTime: '2026-11-18T19:00:00+05:30', // 11 hours elapsed - 1 hr break = 10 paid hours
    });

    expect(result.elapsedHours).toBe(11);
    expect(result.paidHours).toBe(10);
    expect(result.overtimeHours).toBe(2);
    expect(result.overtimePay).toBe(600); // 2 * 300
    expect(result.netDailyPay).toBe(2600);
  });

  it('Example 3: Morning Half-Day: 8:00 AM – 12:00 PM (4 paid hours, 0 lunch deduction)', () => {
    const result = calculateDailyPayroll({
      ...baseParams,
      startTime: '2026-11-18T08:00:00+05:30',
      offTime: '2026-11-18T12:00:00+05:30', // 4 hours elapsed, left before 12 PM lunch
    });

    expect(result.elapsedHours).toBe(4);
    expect(result.unpaidBreakHours).toBe(0);
    expect(result.paidHours).toBe(4);
    expect(result.shortageHours).toBe(4);
    expect(result.shortageDeduction).toBe(1200); // 4 * 300
    expect(result.netDailyPay).toBe(800);
  });

  it('Example 4: Afternoon Half-Day: 1:00 PM – 5:00 PM (4 paid hours, 0 lunch deduction)', () => {
    const result = calculateDailyPayroll({
      ...baseParams,
      startTime: '2026-11-18T13:00:00+05:30',
      offTime: '2026-11-18T17:00:00+05:30', // 4 hours elapsed, started after 1 PM lunch
    });

    expect(result.elapsedHours).toBe(4);
    expect(result.unpaidBreakHours).toBe(0);
    expect(result.paidHours).toBe(4);
    expect(result.shortageHours).toBe(4);
    expect(result.shortageDeduction).toBe(1200); // 4 * 300
    expect(result.netDailyPay).toBe(800);
  });

  it('Example 5: Confirmed Overnight Shift: 8:00 AM to Next Day 10:00 AM (all hours past 5 PM as OT)', () => {
    // 8:00 AM Day 1 to 10:00 AM Day 2 = 26 hours elapsed
    // 1 hr lunch deducted = 25 paid hours
    // 8 regular hours + 17 overtime hours (5 PM Day 1 to 10 AM Day 2 = 17 hrs OT)
    const result = calculateDailyPayroll({
      ...baseParams,
      startTime: '2026-11-18T08:00:00+05:30',
      offTime: '2026-11-19T10:00:00+05:30',
    });

    expect(result.elapsedHours).toBe(26);
    expect(result.unpaidBreakHours).toBe(1.0);
    expect(result.paidHours).toBe(25);
    expect(result.overtimeHours).toBe(17); // 17 hours after 5:00 PM
    expect(result.overtimePay).toBe(5100); // 17 * 300
    expect(result.shortageHours).toBe(0);
    expect(result.netDailyPay).toBe(7100); // 2000 base + 5100 OT
  });
});
