import http from "node:http";
import https from "node:https";

/** IPv4-only fetch for scripts on networks where Node fetch times out (USDA, Wger). */
export async function fetchJson<T>(url: string): Promise<T> {
  const parsed = new URL(url);
  const lib = parsed.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.get(
      url,
      { family: 4, timeout: 30_000, headers: { Accept: "application/json", "User-Agent": "kak-fit/1.0" } },
      (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${url}`));
            return;
          }
          try {
            resolve(JSON.parse(body) as T);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout: ${url}`));
    });
  });
}
