import http from "node:http";
import https from "node:https";

type ExternalResponse = {
  ok: boolean;
  status: number;
  json: <T>() => Promise<T>;
  text: () => Promise<string>;
};

/**
 * Node's default fetch races IPv6/IPv4 with short timeouts — fails on IPv4-only
 * networks when external APIs (USDA, Wger) resolve to both. Force IPv4 + 30s.
 */
export async function fetchExternal(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<ExternalResponse> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const parsed = new URL(url);
  const lib = parsed.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.get(
      url,
      {
        family: 4,
        timeout: timeoutMs,
        headers: {
          "User-Agent": "kak-fit/1.0",
          Accept: "application/json",
          ...options.headers,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          const status = res.statusCode ?? 500;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async <T>() => JSON.parse(body) as T,
            text: async () => body,
          });
        });
      },
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`External request timed out after ${timeoutMs}ms`));
    });
  });
}
