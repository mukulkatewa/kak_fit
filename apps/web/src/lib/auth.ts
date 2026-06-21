import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "@kak-fit/db";

const authBaseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const authHost = authBaseUrl.replace(/^https?:\/\//, "").replace(/:\d+$/, "");

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authBaseUrl,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [bearer()],
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "exp://localhost:8081",
    authBaseUrl,
    `http://${authHost}:8081`,
    `exp://${authHost}:8081`,
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
