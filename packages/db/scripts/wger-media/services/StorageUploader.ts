import { createHash } from "node:crypto";
import { extname } from "node:path";

export type UploadInput = {
  bytes: Buffer;
  originalUrl: string;
  contentType?: string | null;
  type: "IMAGE" | "VIDEO";
  source?: string;
};

export type UploadResult = { storageUrl: string; path: string };

type SupabaseConfig = { url: string; key: string; bucket: string };

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_EXERCISE_MEDIA_BUCKET ?? process.env.SUPABASE_IMAGE_BUCKET ?? process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !key || !bucket) {
    throw new Error(
      "Supabase media storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_EXERCISE_MEDIA_BUCKET, SUPABASE_IMAGE_BUCKET, or SUPABASE_STORAGE_BUCKET.",
    );
  }
  return { url, key, bucket };
}

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, apikey: key };
}

function uploadTimeoutMs(): number {
  return Number(process.env.SUPABASE_MEDIA_UPLOAD_TIMEOUT_MS ?? "90000");
}

function storagePrefix(input: UploadInput): string {
  return (input.source ?? "wger").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "media";
}

function extensionFrom(input: UploadInput): string {
  if (input.type === "VIDEO" && input.contentType?.includes("mp4")) return "mp4";
  const fromUrl = extname(new URL(input.originalUrl).pathname).replace(/^\./, "").toLowerCase();
  if (fromUrl) return fromUrl.slice(0, 8);
  if (input.contentType?.includes("png")) return "png";
  if (input.contentType?.includes("webp")) return "webp";
  if (input.contentType?.includes("gif")) return "gif";
  if (input.contentType?.includes("mp4")) return "mp4";
  if (input.contentType?.includes("webm")) return "webm";
  return input.type === "IMAGE" ? "jpg" : "mp4";
}

async function ensureBucket(config: SupabaseConfig): Promise<void> {
  const res = await fetch(`${config.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders(config.key), "Content-Type": "application/json" },
    body: JSON.stringify({ id: config.bucket, name: config.bucket, public: true }),
  });
  const body = await res.text().catch(() => "");
  if (res.ok || res.status === 409 || body.includes('"statusCode":"409"') || body.includes('"Duplicate"')) return;
  throw new Error(`Could not ensure Supabase bucket ${config.bucket}: ${res.status} ${body.slice(0, 160)}`);
}

export class StorageUploader {
  private bucketReady = false;

  async upload(input: UploadInput): Promise<UploadResult> {
    const config = getSupabaseConfig();
    if (!this.bucketReady) {
      await ensureBucket(config);
      this.bucketReady = true;
    }

    const hash = createHash("sha256").update(input.originalUrl).digest("hex").slice(0, 24);
    const ext = extensionFrom(input);
    const folder = input.type === "IMAGE" ? "images" : "videos";
    const path = `${storagePrefix(input)}/${folder}/${hash}.${ext}`;

    const controller = new AbortController();
    const timeoutMs = uploadTimeoutMs();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${path}`, {
        method: "POST",
        headers: {
          ...authHeaders(config.key),
          "Content-Type": input.contentType ?? "application/octet-stream",
          "x-upsert": "true",
        },
        body: input.bytes as unknown as BodyInit,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Supabase upload timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Supabase upload failed (${res.status}): ${body.slice(0, 200)}`);
    }

    return {
      path,
      storageUrl: `${config.url}/storage/v1/object/public/${config.bucket}/${path}`,
    };
  }
}
