import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "@kak-fit/db";

const authBaseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

function parseHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    const match = url.match(/^https?:\/\/([^/:]+)/);
    return match?.[1] ?? null;
  }
}

/** Expo Go / web preview origins for a given host (LAN IP or localhost). */
function expoOriginsForHost(host: string): string[] {
  return [
    `http://${host}:8081`,
    `http://${host}:19006`,
    `exp://${host}:8081`,
    `exp://${host}:19006`,
  ];
}

function buildTrustedOrigins(): string[] {
  const origins = new Set([
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:19006",
    "exp://localhost:8081",
    "exp://localhost:19006",
    authBaseUrl,
  ]);

  for (const host of [parseHost(authBaseUrl), parseHost(process.env.EXPO_PUBLIC_API_URL ?? "")].filter(
    Boolean,
  ) as string[]) {
    for (const origin of expoOriginsForHost(host)) origins.add(origin);
  }

  for (const extra of (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) origins.add(trimmed);
  }

  return [...origins];
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authBaseUrl,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [bearer()],
  trustedOrigins: buildTrustedOrigins(),
});

export type AuthSession = typeof auth.$Infer.Session;
