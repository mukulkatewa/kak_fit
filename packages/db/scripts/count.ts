import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../.env") });

async function main() {
  const { prisma } = await import("../src/index");
  const [users, exercises] = await Promise.all([
    prisma.user.count(),
    prisma.exercise.count({ where: { isCustom: false } }),
  ]);
  console.log(`Users: ${users}`);
  console.log(`Exercises: ${exercises}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
