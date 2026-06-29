import "./env-check";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "@kak-fit/db";
import { buildTrustedOrigins } from "./trusted-origins";

const authBaseUrl =
  process.env.BETTER_AUTH_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

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
