import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient, User } from "@kak-fit/db";

export type ApiAuthContext = {
  user: Pick<User, "id" | "email" | "name" | "subscriptionTier" | "weightUnit" | "createdAt">;
  apiKeyId: string;
};

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { rawKey: string; prefix: string; hash: string } {
  const rawKey = `kak_${randomBytes(24).toString("base64url")}`;
  return {
    rawKey,
    prefix: rawKey.slice(0, 12),
    hash: hashApiKey(rawKey),
  };
}

export function extractApiKey(request: Request): string | null {
  const header = request.headers.get("api-key") ?? request.headers.get("x-api-key");
  if (header?.startsWith("kak_")) return header;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer kak_")) return auth.slice(7);

  return null;
}

export function requireProApi(user: Pick<User, "subscriptionTier">) {
  if (process.env.DEVELOPER_API_REQUIRE_PRO === "true" && user.subscriptionTier !== "PRO") {
    throw new PublicApiError(403, "Developer API requires Kak Fit Pro");
  }
}

export class PublicApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

export async function authenticateApiKey(
  prisma: PrismaClient,
  request: Request,
): Promise<ApiAuthContext> {
  const rawKey = extractApiKey(request);
  if (!rawKey) {
    throw new PublicApiError(401, "Missing api-key header");
  }

  const keyHash = hashApiKey(rawKey);
  const record = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
          weightUnit: true,
          createdAt: true,
        },
      },
    },
  });

  if (!record) {
    throw new PublicApiError(401, "Invalid API key");
  }

  requireProApi(record.user);

  void prisma.apiKey
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);

  return { user: record.user, apiKeyId: record.id };
}
