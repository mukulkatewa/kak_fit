import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { HevyClientConfig } from "./types";

const DEFAULT_BASE_URL = "https://api.hevyapp.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_REQUESTS_PER_MINUTE = 30;
const DEFAULT_MAX_RETRIES = 3;

export type HevyClientOptions = Partial<HevyClientConfig> & {
  apiKey?: string;
  debug?: boolean;
};

export function loadHevyApiKey(): string {
  const key = process.env.HEVY_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "HEVY_API_KEY is not set. Add it to .env (Hevy Pro → Settings → Developer).",
    );
  }
  return key;
}

export class HevyApiClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
  readonly requestsPerMinute: number;
  readonly maxRetries: number;
  readonly debug: boolean;

  private requestTimestamps: number[] = [];
  private totalRequests = 0;

  constructor(options: HevyClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.apiKey = options.apiKey ?? loadHevyApiKey();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.requestsPerMinute = options.requestsPerMinute ?? DEFAULT_REQUESTS_PER_MINUTE;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.debug = options.debug ?? process.env.HEVY_API_DEBUG === "1";
  }

  get requestCount(): number {
    return this.totalRequests;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const windowMs = 60_000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < windowMs);

    if (this.requestTimestamps.length >= this.requestsPerMinute) {
      const oldest = this.requestTimestamps[0]!;
      const waitMs = windowMs - (now - oldest) + 50;
      if (this.debug) {
        console.log(`[hevy] rate limit: waiting ${waitMs}ms`);
      }
      await new Promise((r) => setTimeout(r, waitMs));
    }

    this.requestTimestamps.push(Date.now());
  }

  private log(message: string): void {
    if (this.debug) console.log(`[hevy] ${message}`);
  }

  async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 30_000);
        this.log(`retry ${attempt}/${this.maxRetries} after ${delay}ms — ${method} ${path}`);
        await new Promise((r) => setTimeout(r, delay));
      }

      await this.throttle();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        this.log(`${method} ${url}`);
        this.totalRequests += 1;

        const response = await fetch(url, {
          method,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "api-key": this.apiKey,
            "User-Agent": "kak-fit-hevy-import/1.0",
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        const text = await response.text();
        let json: unknown = null;
        if (text) {
          try {
            json = JSON.parse(text);
          } catch {
            json = text;
          }
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error(`Hevy auth failed (${response.status}). Check HEVY_API_KEY.`);
        }

        if (response.status === 429) {
          if (attempt < this.maxRetries) continue;
          throw new Error(`Hevy rate limited (429): ${path}`);
        }

        if (!response.ok) {
          const detail =
            typeof json === "object" && json && "error" in json
              ? String((json as { error: unknown }).error)
              : text.slice(0, 200);
          if (response.status >= 500 && attempt < this.maxRetries) continue;
          throw new Error(`Hevy API ${response.status} ${path}: ${detail}`);
        }

        return json as T;
      } catch (error) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        if ((isAbort || error instanceof TypeError) && attempt < this.maxRetries) {
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    throw new Error(`Hevy request failed after retries: ${method} ${path}`);
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  /** Paginate Hevy list endpoints that use page + page_count + array key. */
  async paginate<TItem>(
    path: string,
    arrayKey: string,
    pageSize: number,
    maxPages?: number,
  ): Promise<TItem[]> {
    const items: TItem[] = [];
    let page = 1;
    let pageCount = 1;

    while (page <= pageCount) {
      const separator = path.includes("?") ? "&" : "?";
      const data = await this.get<Record<string, unknown>>(
        `${path}${separator}page=${page}&pageSize=${pageSize}`,
      );

      pageCount = Number(data.page_count ?? 1);
      const batch = data[arrayKey];
      if (!Array.isArray(batch)) {
        throw new Error(`Expected array key "${arrayKey}" in response for ${path}`);
      }

      items.push(...(batch as TItem[]));
      this.log(`page ${page}/${pageCount} — ${batch.length} items (${items.length} total)`);

      if (maxPages && page >= maxPages) break;
      page += 1;
    }

    return items;
  }

  async saveSample(name: string, data: unknown): Promise<string> {
    const dir = resolve(__dirname, "hevy-api-samples");
    await mkdir(dir, { recursive: true });
    const file = resolve(dir, `${name}.json`);
    await writeFile(file, JSON.stringify(data, null, 2), "utf8");
    return file;
  }
}

export function createHevyClient(options?: HevyClientOptions): HevyApiClient {
  return new HevyApiClient(options);
}
