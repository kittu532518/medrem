/**
 * Session Engine — critical timestamp / session assignment logic
 *
 * Session windows (local time):
 *   morning:   07:00 – 10:00
 *   afternoon: 12:00 – 14:00
 *   evening:   17:00 – 20:00
 *   night:     21:00 – 23:00
 *
 * Assignment rules (from PRD):
 *  1. Photo taken up to 60 min BEFORE session start → accept for that upcoming session
 *  2. Photo taken WITHIN session window → accept for that session
 *  3. Photo taken AFTER window closes but BEFORE next session starts → REJECT (offer Partial)
 *  4. Photo taken AFTER next session has already started → assign to THAT NEXT session; missed = FAILURE
 *  5. Photo EXIF date ≠ today → REJECT immediately
 */

export const SESSIONS = {
  morning:   { start: [7, 0],  end: [10, 0] },
  afternoon: { start: [12, 0], end: [14, 0] },
  evening:   { start: [17, 0], end: [20, 0] },
  night:     { start: [21, 0], end: [23, 0] },
};

export const SESSION_ORDER = ['morning', 'afternoon', 'evening', 'night'];

/**
 * Convert a session's [h, m] to minutes since midnight
 */
function toMinutes([h, m]) {
  return h * 60 + m;
}

/**
 * Get minutes since midnight for a Date object
 */
function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function todayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Format a Date as YYYY-MM-DD
 */
export function dateString(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Determine which session a given timestamp belongs to, applying PRD rules.
 *
 * @param {Date|null} exifTimestamp  — timestamp from photo EXIF (or null if unavailable)
 * @param {Date}      now            — current server time (for rule 3/4 checks)
 * @param {string}    targetSession  — the session the dose was scheduled for
 * @returns {{
 *   action: 'accept'|'reject'|'assign_to_next'|'reject_wrong_day',
 *   session: string,
 *   message: string,
 *   exifUsed: boolean
 * }}
 */
export function assignPhotoToSession(exifTimestamp, now, targetSession) {
  const photoTime = exifTimestamp || now;
  const exifUsed = !!exifTimestamp;

  // Rule 5: EXIF date must be today
  if (exifTimestamp) {
    const photoDate = dateString(exifTimestamp);
    const todayDate = dateString(now);
    if (photoDate !== todayDate) {
      return {
        action: 'reject_wrong_day',
        session: targetSession,
        message: `Photo was taken on ${photoDate}, but today is ${todayDate}. Please take a fresh photo.`,
        exifUsed,
      };
    }
  }

  const photoMin = minutesOfDay(photoTime);
  const nowMin = minutesOfDay(now);

  // Build list of sessions with their minute ranges
  const sessionRanges = SESSION_ORDER.map((name) => ({
    name,
    startMin: toMinutes(SESSIONS[name].start),
    endMin:   toMinutes(SESSIONS[name].end),
  }));

  const targetIdx = SESSION_ORDER.indexOf(targetSession);
  const target = sessionRanges[targetIdx];

  // Rule 1: Up to 60 min before session start
  const earlyStart = target.startMin - 60;
  if (photoMin >= earlyStart && photoMin < target.startMin) {
    return {
      action: 'accept',
      session: targetSession,
      message: 'Photo accepted — taken just before the session window.',
      exifUsed,
    };
  }

  // Rule 2: Within session window
  if (photoMin >= target.startMin && photoMin <= target.endMin) {
    return {
      action: 'accept',
      session: targetSession,
      message: 'Photo accepted — taken within the session window.',
      exifUsed,
    };
  }

  // Photo is after current session's end — check next session
  if (photoMin > target.endMin) {
    const nextIdx = targetIdx + 1;

    if (nextIdx >= SESSION_ORDER.length) {
      // No next session today — reject
      return {
        action: 'reject',
        session: targetSession,
        message: 'The session window has closed and there are no more sessions today. You can mark this as Partial Success.',
        exifUsed,
      };
    }

    const next = sessionRanges[nextIdx];

    // Rule 3: After target window closes but BEFORE next session starts
    if (photoMin < next.startMin) {
      return {
        action: 'reject',
        session: targetSession,
        message: `The ${targetSession} window has closed. You can mark this dose as Partial Success, or wait for the ${next.name} session.`,
        exifUsed,
      };
    }

    // Rule 4: Next session has already started → assign to next session
    if (photoMin >= next.startMin) {
      return {
        action: 'assign_to_next',
        session: next.name,
        message: `Photo is being assigned to the ${next.name} session. The ${targetSession} session will be marked as a failure.`,
        exifUsed,
      };
    }
  }

  // Fallback (shouldn't reach here normally)
  return {
    action: 'reject',
    session: targetSession,
    message: 'Unable to determine session assignment. Please try again.',
    exifUsed,
  };
}

/**
 * Get the current active session (if any) based on current time.
 * Returns null if we are between sessions.
 */
export function getCurrentSession(now = new Date()) {
  const min = minutesOfDay(now);
  for (const name of SESSION_ORDER) {
    const s = SESSIONS[name];
    const start = toMinutes(s.start);
    const end = toMinutes(s.end);
    if (min >= start && min <= end) {
      return name;
    }
  }
  return null;
}

/**
 * Get the next upcoming session and its start time.
 */
export function getNextSession(now = new Date()) {
  const min = minutesOfDay(now);
  for (const name of SESSION_ORDER) {
    const s = SESSIONS[name];
    const start = toMinutes(s.start);
    if (start > min) {
      return { name, startHour: s.start[0], startMin: s.start[1] };
    }
  }
  // Past all sessions — next morning
  return { name: 'morning', startHour: 7, startMin: 0, tomorrow: true };
}

/**
 * Check if a session window has passed for today.
 */
export function isSessionPast(sessionName, now = new Date()) {
  const min = minutesOfDay(now);
  const s = SESSIONS[sessionName];
  if (!s) return false;
  return min > toMinutes(s.end);
}

/**
 * Get all sessions scheduled for today and their status windows.
 */
export function getTodaySessionWindows() {
  return SESSION_ORDER.map((name) => ({
    name,
    startHour: SESSIONS[name].start[0],
    startMin:  SESSIONS[name].start[1],
    endHour:   SESSIONS[name].end[0],
    endMin:    SESSIONS[name].end[1],
  }));
}
