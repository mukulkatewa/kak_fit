import { apiHeaders, getApiUrl } from "./api-client";

let checkPromise: Promise<boolean> | null = null;

/** One-time dev check — any HTTP response means the host is reachable. */
export async function checkApiReachable(): Promise<boolean> {
  if (checkPromise) return checkPromise;

  checkPromise = (async () => {
    try {
      await fetch(`${getApiUrl()}/api/trpc?batch=1`, {
        method: "GET",
        headers: apiHeaders(),
      });
      return true;
    } catch {
      return false;
    }
  })();

  return checkPromise;
}
