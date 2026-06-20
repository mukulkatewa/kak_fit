import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../.env") });

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "../src/index";

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  plugins: [bearer()],
});

async function seedDemo() {
  const email = "demo@kakfit.app";
  const password = "password123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists:", email);
    return;
  }

  const result = await auth.api.signUpEmail({
    body: { email, password, name: "Demo Lifter" },
  });

  if (!result.user) throw new Error("Failed to create demo user");

  console.log("Demo user created");
  console.log("  Email:", email);
  console.log("  Password:", password);
}

seedDemo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
