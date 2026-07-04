/** Start of calendar day in the user's local timezone, expressed as UTC. */
export function startOfUserDay(now = new Date(), timezoneOffsetMinutes?: number): Date {
  if (timezoneOffsetMinutes === undefined) {
    const utc = new Date(now);
    utc.setUTCHours(0, 0, 0, 0);
    return utc;
  }

  // Same convention as Date.getTimezoneOffset() from the client (UTC − local, in minutes).
  const local = new Date(now.getTime() - timezoneOffsetMinutes * 60_000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + timezoneOffsetMinutes * 60_000);
}

export type UserDayInput = {
  dateMs?: number;
  timezoneOffsetMinutes?: number;
};

/** Resolve [start, end) UTC bounds for a user-local calendar day. */
export function resolveUserDayRange(
  input?: UserDayInput,
  dayMs = 24 * 60 * 60 * 1000,
): { start: Date; end: Date } {
  const ref = input?.dateMs != null ? new Date(input.dateMs) : new Date();
  const start = startOfUserDay(ref, input?.timezoneOffsetMinutes);
  return { start, end: new Date(start.getTime() + dayMs) };
}
