import type { PrismaClient } from "@prisma/client";
import { hevyCategoryName } from "./mappings";

/** Resolve or create a Hevy exercise-type category for any API slug. */
export async function ensureHevyCategory(
  prisma: PrismaClient,
  typeSlug: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(typeSlug);
  if (cached) return cached;

  const name = hevyCategoryName(typeSlug);
  const existing = await prisma.category.findFirst({ where: { name } });
  const record = existing ?? (await prisma.category.create({ data: { name } }));
  cache.set(typeSlug, record.id);
  return record.id;
}
