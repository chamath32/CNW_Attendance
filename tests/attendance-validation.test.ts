import { describe, it, expect } from 'vitest';
import { validateAttendanceEvent } from '../src/lib/attendance-validator';
import { AttendanceEvent } from '../src/types';

describe('CNW Workforce — Attendance Validation Rules (Sections 7, 8, 9)', () => {
  const mockNow = '2026-11-18T12:00:00.000Z';

  const mockStartEvent: AttendanceEvent = {
    id: 'evt-001',
    sessionGroupId: 'sess-001',
    employeeId: 'emp-001',
    siteId: 'site-001',
    eventType: 'START',
    deviceTimestamp: '2026-11-18T08:00:00.000Z',
    isOfflineCreated: false,
    rawPopulatedTime: '2026-11-18T08:00:00.000Z',
    effectiveEventTime: '2026-11-18T08:00:00.000Z',
    wasTimeAdjusted: false,
    createdUserId: 'usr-emp-001',
    createdAt: '2026-11-18T08:00:00.000Z',
  };

  it('Rejects future timestamps', () => {
    const futureTime = '2026-11-18T15:00:00.000Z'; // 3 hours ahead of mockNow
    const res = validateAttendanceEvent({
      eventType: 'START',
      newTimeISO: futureTime,
      currentTimeISO: mockNow,
      currentWorkingStatus: 'IDLE',
    });

    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('FUTURE_TIME_NOT_ALLOWED');
  });

  it('Rejects START if employee is already working (cannot START twice without OFF)', () => {
    const res = validateAttendanceEvent({
      eventType: 'START',
      newTimeISO: '2026-11-18T08:00:00.000Z',
      currentTimeISO: mockNow,
      currentWorkingStatus: 'WORKING',
      currentSessionStart: mockStartEvent,
    });

    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('ALREADY_WORKING');
  });

  it('Rejects MOVING if employee has not started work', () => {
    const res = validateAttendanceEvent({
      eventType: 'MOVE',
      newTimeISO: '2026-11-18T10:00:00.000Z',
      currentTimeISO: mockNow,
      currentWorkingStatus: 'IDLE',
    });

    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('NOT_WORKING_MOVE');
  });

  it('Allows MOVING when working and time is after START', () => {
    const res = validateAttendanceEvent({
      eventType: 'MOVE',
      newTimeISO: '2026-11-18T10:30:00.000Z',
      currentTimeISO: mockNow,
      currentWorkingStatus: 'WORKING',
      currentSessionStart: mockStartEvent,
    });

    expect(res.isValid).toBe(true);
  });

  it('Rejects OFF if employee has not started work', () => {
    const res = validateAttendanceEvent({
      eventType: 'OFF',
      newTimeISO: '2026-11-18T11:00:00.000Z',
      currentTimeISO: mockNow,
      currentWorkingStatus: 'IDLE',
    });

    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('NOT_WORKING_OFF');
  });

  it('Rejects OFF if timestamp is earlier than START time', () => {
    const res = validateAttendanceEvent({
      eventType: 'OFF',
      newTimeISO: '2026-11-18T07:30:00.000Z', // Before 8:00 AM start
      currentTimeISO: mockNow,
      currentWorkingStatus: 'WORKING',
      currentSessionStart: mockStartEvent,
    });

    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('OFF_BEFORE_START');
  });

  it('Allows valid OFF after START', () => {
    const res = validateAttendanceEvent({
      eventType: 'OFF',
      newTimeISO: '2026-11-18T11:30:00.000Z',
      currentTimeISO: mockNow,
      currentWorkingStatus: 'WORKING',
      currentSessionStart: mockStartEvent,
    });

    expect(res.isValid).toBe(true);
  });
});
