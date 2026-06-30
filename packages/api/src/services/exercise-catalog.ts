import { Prisma } from "@kak-fit/db";
import type { Prisma as PrismaTypes } from "@kak-fit/db";
import { dedupeExercisesByName } from "../lib/exercise-name";

export const exerciseListInclude = {
  category: { select: { id: true, name: true } },
  muscles: {
    where: { isPrimary: true },
    take: 1,
    include: { muscle: { select: { id: true, name: true } } },
  },
  equipment: {
    take: 3,
    include: { equipment: { select: { id: true, name: true } } },
  },
} as const;

export const exerciseDetailInclude = {
  category: { select: { id: true, name: true } },
  muscles: {
    include: { muscle: { select: { id: true, name: true } } },
    orderBy: { isPrimary: "desc" as const },
  },
  equipment: {
    include: { equipment: { select: { id: true, name: true } } },
  },
} as const;

export type ExerciseListItem = PrismaTypes.ExerciseGetPayload<{ include: typeof exerciseListInclude }>;

export function globalExerciseWhere(userId: string): PrismaTypes.ExerciseWhereInput {
  return {
    OR: [{ isCustom: false }, { isCustom: true, userId }],
  };
}

const catalogScoreSql = Prisma.sql`(
  CASE WHEN e."imageUrl" IS NOT NULL THEN 100 ELSE 0 END +
  CASE WHEN e.instructions IS NOT NULL AND btrim(e.instructions) <> '' THEN 20 ELSE 0 END +
  CASE WHEN e."wgerId" IS NOT NULL THEN 10 ELSE 0 END +
  CASE WHEN e."hevyId" IS NOT NULL THEN 5 ELSE 0 END
)`;

const normalizedNameSql = Prisma.sql`trim(regexp_replace(
  regexp_replace(
    regexp_replace(lower(e.name), '\\s*\\([^)]*\\)', '', 'g'),
    '[^a-z0-9\\s]', ' ', 'g'
  ),
  '\\s+', ' ', 'g'
))`;

function buildCatalogFilters(
  userId: string,
  options: {
    search?: string;
    muscleId?: string;
    categoryId?: string;
    customOnly?: boolean;
  },
): Prisma.Sql {
  const filters: Prisma.Sql[] = [
    Prisma.sql`(e."isCustom" = false OR (e."isCustom" = true AND e."userId" = ${userId}))`,
  ];

  if (options.search) {
    filters.push(Prisma.sql`e.name ILIKE ${`%${options.search}%`}`);
  }
  if (options.customOnly) {
    filters.push(Prisma.sql`e."isCustom" = true AND e."userId" = ${userId}`);
  }
  if (options.categoryId) {
    filters.push(Prisma.sql`e."categoryId" = ${options.categoryId}`);
  }
  if (options.muscleId) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "ExerciseMuscle" em
      WHERE em."exerciseId" = e.id AND em."muscleId" = ${options.muscleId}
    )`);
  }

  return Prisma.join(filters, " AND ");
}

/**
 * List catalog exercises with deduplication by normalized name.
 * Prefers Wger rows (images/instructions) and merges Hevy metadata via hevyId on same row.
 */
export async function listCatalogExercises(
  prisma: PrismaTypes.TransactionClient | import("@kak-fit/db").PrismaClient,
  options: {
    userId: string;
    search?: string;
    muscleId?: string;
    categoryId?: string;
    customOnly?: boolean;
    cursor?: string;
    limit: number;
  },
): Promise<ExerciseListItem[]> {
  const whereSql = buildCatalogFilters(options.userId, options);
  const fetchLimit = options.limit + 1;
  const cursorFilter = options.cursor
    ? Prisma.sql`WHERE (name, id) > (
        SELECT name, id FROM "Exercise" WHERE id = ${options.cursor}
      )`
    : Prisma.empty;

  const idRows = await prisma.$queryRaw<Array<{ id: string; name: string }>>(Prisma.sql`
    WITH scored AS (
      SELECT
        e.id,
        e.name,
        ${normalizedNameSql} AS norm_name,
        ${catalogScoreSql} AS catalog_score
      FROM "Exercise" e
      WHERE ${whereSql}
    ),
    deduped AS (
      SELECT DISTINCT ON (norm_name)
        id,
        name,
        norm_name,
        catalog_score
      FROM scored
      ORDER BY norm_name, catalog_score DESC, name ASC
    )
    SELECT id, name
    FROM deduped
    ${cursorFilter}
    ORDER BY name ASC
    LIMIT ${fetchLimit}
  `);

  const selectedIds = idRows.slice(0, options.limit).map((row) => row.id);
  if (selectedIds.length === 0) return [];

  const rows = await prisma.exercise.findMany({
    where: { id: { in: selectedIds } },
    include: exerciseListInclude,
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = selectedIds
    .map((id) => byId.get(id))
    .filter((row): row is ExerciseListItem => row != null);

  // Safety net: if SQL normalization diverges from JS, keep canonical rows only.
  return dedupeExercisesByName(ordered).slice(0, options.limit);
}
