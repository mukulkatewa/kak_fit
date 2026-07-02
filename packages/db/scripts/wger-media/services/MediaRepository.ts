import type { PrismaClient } from "@prisma/client";
import type { WgerMediaItem } from "../types";

function intOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

export class MediaRepository {
  constructor(private prisma: PrismaClient) {}

  async exists(exerciseId: string, originalUrl: string): Promise<boolean> {
    const existing = await this.prisma.exerciseMedia.findUnique({
      where: { exerciseId_originalUrl: { exerciseId, originalUrl } },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async upsertMedia(args: {
    exerciseId: string;
    item: WgerMediaItem;
    storageUrl: string;
    fileSize: number;
    mimeType?: string | null;
    force: boolean;
  }) {
    return this.prisma.exerciseMedia.upsert({
      where: { exerciseId_originalUrl: { exerciseId: args.exerciseId, originalUrl: args.item.originalUrl } },
      create: {
        exerciseId: args.exerciseId,
        type: args.item.type,
        storageUrl: args.storageUrl,
        thumbnailUrl: args.item.thumbnailUrl ?? null,
        originalUrl: args.item.originalUrl,
        mimeType: args.mimeType ?? args.item.mimeType ?? null,
        displayOrder: args.item.displayOrder,
        width: args.item.width ?? null,
        height: args.item.height ?? null,
        duration: intOrNull(args.item.duration),
        fileSize: args.fileSize,
        source: "wger",
      },
      update: args.force
        ? {
            storageUrl: args.storageUrl,
            thumbnailUrl: args.item.thumbnailUrl ?? null,
            mimeType: args.mimeType ?? args.item.mimeType ?? null,
            displayOrder: args.item.displayOrder,
            width: args.item.width ?? null,
            height: args.item.height ?? null,
            duration: intOrNull(args.item.duration),
            fileSize: args.fileSize,
            source: "wger",
          }
        : {},
    });
  }
}
