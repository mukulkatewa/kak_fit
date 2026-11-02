/** Cancellation and ambiguous timeouts must not be treated as confirmed offline writes. */
export function isNetworkError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return false;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network request failed|failed to fetch|load failed|internet|offline|econn|fetch failed/i.test(message);
}
