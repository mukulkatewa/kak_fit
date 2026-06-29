import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../.env") });

import { prisma } from "../src/index";

async function seedDemo() {
  const email = "demo@kakfit.app";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists:", email);
    return;
  }

  console.log("No demo user in database.");
  console.log("Sign in with Google to create your account — email/password auth is disabled.");
}

seedDemo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
