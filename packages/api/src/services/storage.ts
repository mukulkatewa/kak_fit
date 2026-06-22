/**
 * Minimal Supabase Storage client (no SDK) using the service-role key. Uploads
 * run server-side so the key never reaches the client.
 */

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "progress-photos";

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isStorageConfigured(): boolean {
  return getConfig() !== null;
}

let bucketEnsured = false;

/** Create the bucket (public) if it doesn't already exist. Idempotent. */
async function ensureBucket(url: string, key: string): Promise<void> {
  if (bucketEnsured) return;
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  // 200 = created, 409 = already exists — both are fine.
  if (res.ok || res.status === 409) {
    bucketEnsured = true;
    return;
  }
  // Don't hard-fail; the upload will surface a clearer error if needed.
}

export type UploadResult = { url: string; path: string };

export async function uploadImage(
  userId: string,
  base64: string,
  contentType: string,
): Promise<UploadResult> {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "Supabase Storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const { url, key } = config;
  await ensureBucket(url, key);

  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bytes = Buffer.from(base64, "base64");

  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}). ${body.slice(0, 120)}`);
  }

  return {
    url: `${url}/storage/v1/object/public/${BUCKET}/${path}`,
    path,
  };
}

export async function deleteImage(path: string): Promise<void> {
  const config = getConfig();
  if (!config) return;
  const { url, key } = config;
  await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => undefined);
}
