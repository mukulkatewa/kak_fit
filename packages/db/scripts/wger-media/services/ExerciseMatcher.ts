import type { PrismaClient } from "@prisma/client";
import { calculateConfidenceScore, type MatchMetadata } from "../utils/calculateConfidenceScore";
import { normalizeExerciseName } from "../utils/normalizeExerciseName";
import type { MatchResult, WgerSourceExercise } from "../types";

type Candidate = {
  id: string;
  name: string;
  metadata: MatchMetadata;
};

const CONFIDENCE_THRESHOLD = 55;

function sourceMetadata(source: WgerSourceExercise): MatchMetadata {
  return {
    primaryMuscles: source.primaryMuscles,
    secondaryMuscles: source.secondaryMuscles,
    equipment: source.equipment,
    category: source.category,
  };
}

export class ExerciseMatcher {
  private exact = new Map<string, Candidate[]>();
  private normalized = new Map<string, Candidate[]>();

  constructor(private prisma: PrismaClient) {}

  async load(): Promise<void> {
    const exercises = await this.prisma.exercise.findMany({
      where: { isCustom: false },
      select: {
        id: true,
        name: true,
        category: { select: { name: true } },
        muscles: { include: { muscle: { select: { name: true } } } },
        equipment: { include: { equipment: { select: { name: true } } } },
      },
    });

    for (const exercise of exercises) {
      const candidate: Candidate = {
        id: exercise.id,
        name: exercise.name,
        metadata: {
          primaryMuscles: exercise.muscles.filter((m) => m.isPrimary).map((m) => m.muscle.name),
          secondaryMuscles: exercise.muscles.filter((m) => !m.isPrimary).map((m) => m.muscle.name),
          equipment: exercise.equipment.map((item) => item.equipment.name),
          category: exercise.category?.name ?? null,
        },
      };
      this.add(this.exact, exercise.name.toLowerCase().trim(), candidate);
      this.add(this.normalized, normalizeExerciseName(exercise.name), candidate);
    }
  }

  match(source: WgerSourceExercise): MatchResult {
    const exact = this.exact.get(source.name.toLowerCase().trim()) ?? [];
    if (exact.length === 1) {
      return { status: "matched", exerciseId: exact[0]!.id, confidence: 100, reason: "exact_name" };
    }
    if (exact.length > 1) return this.pickBest(exact, source, "exact_name_multiple");

    const normalized = this.normalized.get(normalizeExerciseName(source.name)) ?? [];
    if (normalized.length === 1) {
      return { status: "matched", exerciseId: normalized[0]!.id, confidence: 92, reason: "normalized_name" };
    }
    if (normalized.length > 1) return this.pickBest(normalized, source, "normalized_name_multiple");

    return { status: "manual_review", confidence: 0, reason: "no_name_match", candidates: [] };
  }

  private pickBest(candidates: Candidate[], source: WgerSourceExercise, reason: string): MatchResult {
    const scored = candidates
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        confidence: calculateConfidenceScore(candidate.metadata, sourceMetadata(source)),
      }))
      .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));

    const best = scored[0];
    const second = scored[1];
    if (best && best.confidence >= CONFIDENCE_THRESHOLD && (!second || best.confidence > second.confidence)) {
      return { status: "matched", exerciseId: best.id, confidence: best.confidence, reason };
    }

    return {
      status: "manual_review",
      confidence: best?.confidence ?? 0,
      reason,
      candidates: scored.slice(0, 5),
    };
  }

  private add(map: Map<string, Candidate[]>, key: string, candidate: Candidate) {
    const list = map.get(key) ?? [];
    list.push(candidate);
    map.set(key, list);
  }
}
