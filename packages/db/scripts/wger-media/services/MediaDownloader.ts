import { withRetry } from "../utils/retryDownload";

export type DownloadResult = {
  bytes: Buffer;
  mimeType: string | null;
  fileSize: number;
};

export class MediaDownloader {
  constructor(
    private retries: number,
    private timeoutMs = Number(process.env.WGER_MEDIA_DOWNLOAD_TIMEOUT_MS ?? "90000"),
  ) {}

  async download(url: string): Promise<DownloadResult> {
    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "KakFit-WgerMediaImporter/1.0" },
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`Download failed ${res.status} ${res.statusText}`);
          const bytes = Buffer.from(await res.arrayBuffer());
          if (bytes.length === 0) throw new Error("Downloaded empty file");
          return {
            bytes,
            mimeType: res.headers.get("content-type"),
            fileSize: bytes.length,
          };
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`Download timed out after ${this.timeoutMs}ms`);
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }
      },
      { retries: this.retries, baseDelayMs: 500, label: url },
    );
  }
}
