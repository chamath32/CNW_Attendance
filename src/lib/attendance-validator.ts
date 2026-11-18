import { AttendanceEvent, EventType } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
  errorMessageSi?: string;
}

export interface ValidateEventParams {
  eventType: EventType;
  newTimeISO: string;
  currentTimeISO: string; // Current trusted server / device time
  currentWorkingStatus: 'IDLE' | 'WORKING';
  lastEvent?: AttendanceEvent | null;
  currentSessionStart?: AttendanceEvent | null;
  previousSessionOff?: AttendanceEvent | null;
}

/**
 * Validate attendance event according to CNW Section 7, 8, and 9 rules.
 */
export function validateAttendanceEvent(params: ValidateEventParams): ValidationResult {
  const {
    eventType,
    newTimeISO,
    currentTimeISO,
    currentWorkingStatus,
    currentSessionStart,
    previousSessionOff,
  } = params;

  const newTimeMs = new Date(newTimeISO).getTime();
  const currentTimeMs = new Date(currentTimeISO).getTime();

  if (isNaN(newTimeMs)) {
    return {
      isValid: false,
      errorCode: 'INVALID_TIMESTAMP',
      errorMessage: 'Invalid date/time format.',
      errorMessageSi: 'වලංගු නොවන දිනයක් හෝ වේලාවක්.',
    };
  }

  // 1. Future time check - no future timestamps allowed
  // Allow a small 60-second grace window for minor network clock drift
  if (newTimeMs > currentTimeMs + 60000) {
    return {
      isValid: false,
      errorCode: 'FUTURE_TIME_NOT_ALLOWED',
      errorMessage: 'Attendance time cannot be in the future.',
      errorMessageSi: 'අනාගත වේලාවක් ඇතුළත් කළ නොහැක.',
    };
  }

  // 2. START Event validation
  if (eventType === 'START') {
    if (currentWorkingStatus === 'WORKING') {
      return {
        isValid: false,
        errorCode: 'ALREADY_WORKING',
        errorMessage: 'You already have an active working session. Please record END/OFF first.',
        errorMessageSi: 'ඔබ දැනටමත් වැඩ ආරම්භ කර ඇත. කරුණාකර පළමුව වැඩ අවසන් කරන්න.',
      };
    }

    // When correcting an existing START event or creating new START,
    // do not allow it to be earlier than the preceding valid OFF event.
    if (previousSessionOff) {
      const prevOffMs = new Date(previousSessionOff.effectiveEventTime).getTime();
      if (prevOffMs <= currentTimeMs && newTimeMs < prevOffMs) {
        return {
          isValid: false,
          errorCode: 'START_BEFORE_PREV_OFF',
          errorMessage: 'START time cannot be earlier than your previous work shift OFF time.',
          errorMessageSi: 'පෙර වැඩ මුරය අවසන් වූ වේලාවට පෙර නව ආරම්භක වේලාවක් දැමිය නොහැක.',
        };
      }
    }
  }

  // 3. MOVING Event validation
  if (eventType === 'MOVE') {
    if (currentWorkingStatus !== 'WORKING' || !currentSessionStart) {
      return {
        isValid: false,
        errorCode: 'NOT_WORKING_MOVE',
        errorMessage: 'Cannot MOVE before starting work. Tap START first.',
        errorMessageSi: 'වැඩ ආරම්භ කිරීමට පෙර ස්ථානය මාරු කළ නොහැක. පළමුව START ඔබන්න.',
      };
    }

    const startMs = new Date(currentSessionStart.effectiveEventTime).getTime();
    if (newTimeMs < startMs) {
      return {
        isValid: false,
        errorCode: 'MOVE_BEFORE_START',
        errorMessage: 'Site MOVE time cannot be earlier than session START time.',
        errorMessageSi: 'ස්ථානය මාරු කළ වේලාව වැඩ ආරම්භ කළ වේලාවට පෙර විය නොහැක.',
      };
    }
  }

  // 4. END / OFF Event validation
  if (eventType === 'OFF') {
    if (currentWorkingStatus !== 'WORKING' || !currentSessionStart) {
      return {
        isValid: false,
        errorCode: 'NOT_WORKING_OFF',
        errorMessage: 'Cannot record END/OFF without an active work session. Tap START first.',
        errorMessageSi: 'වැඩ ආරම්භ කර නොමැතිව වැඩ අවසන් කළ නොහැක. පළමුව START ඔබන්න.',
      };
    }

    const startMs = new Date(currentSessionStart.effectiveEventTime).getTime();
    if (newTimeMs <= startMs) {
      return {
        isValid: false,
        errorCode: 'OFF_BEFORE_START',
        errorMessage: 'END/OFF time must be after START time.',
        errorMessageSi: 'වැඩ අවසන් කළ වේලාව ආරම්භ කළ වේලාවට පසුව විය යුතුය.',
      };
    }
  }

  return { isValid: true };
}
