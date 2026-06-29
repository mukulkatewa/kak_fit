import "./env-check";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "@kak-fit/db";
import { buildTrustedOrigins } from "./trusted-origins";

/**
 * OAuth redirect_uri must be stable across deploys — never use VERCEL_URL (unique per deployment).
 * Order: BETTER_AUTH_URL → production alias → localhost.
 */
export function resolveAuthBaseUrl(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const productionHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_BRANCH_URL?.trim();
  if (productionHost) {
    const host = productionHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  if (process.env.VERCEL_URL?.trim()) {
    // Preview deploys only — production should always set BETTER_AUTH_URL explicitly.
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

const authBaseUrl = resolveAuthBaseUrl();

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!googleClientId || !googleClientSecret) {
  console.error(
    "[kak-fit] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for sign-in.",
  );
}

/** Deep links + Expo Go origins for OAuth callback validation. */
const MOBILE_AUTH_ORIGINS = [
  "kakfit://",
  "kakfit://**",
  "exp://",
  "exp://**",
] as const;

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authBaseUrl,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: googleClientId ?? "",
      clientSecret: googleClientSecret ?? "",
    },
  },
  account: {
    storeStateStrategy: "cookie",
  },
  plugins: [expo(), bearer()],
  trustedOrigins: [...buildTrustedOrigins(), ...MOBILE_AUTH_ORIGINS],
});

export type AuthSession = typeof auth.$Infer.Session;
