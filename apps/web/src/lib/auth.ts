import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "@kak-fit/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [bearer()],
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:8081",
    "exp://localhost:8081",
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
