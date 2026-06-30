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
