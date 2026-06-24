import type { PrismaClient } from "@kak-fit/db";
import { syncPersonalRecords } from "../services/personal-records";
import { authenticateApiKey, PublicApiError, type ApiAuthContext } from "./auth";
import { parseRoutineExercisePayload, resolveExercise } from "./helpers";
import { errorResponse, jsonResponse } from "./response";
import {
  dateOnly,
  paginated,
  parseDateParam,
  parsePage,
  parseSetType,
  serializeExerciseTemplate,
  serializeMeasurement,
  serializeRoutine,
  serializeWorkout,
} from "./serialize";

const workoutInclude = {
  exercises: {
    orderBy: { order: "asc" as const },
    include: {
      exercise: { select: { id: true, name: true } },
      sets: { orderBy: { setNumber: "asc" as const } },
    },
  },
} as const;

const routineInclude = {
  exercises: {
    orderBy: { order: "asc" as const },
    include: {
      exercise: { select: { id: true, name: true } },
      sets: { orderBy: { setNumber: "asc" as const } },
    },
  },
} as const;

const exerciseInclude = {
  category: true,
  muscles: { include: { muscle: true } },
} as const;

type Handler = (
  ctx: ApiAuthContext,
  prisma: PrismaClient,
  request: Request,
  params: Record<string, string>,
) => Promise<unknown>;

function workoutExerciseInput(exercises: unknown) {
  if (!Array.isArray(exercises)) {
    throw new PublicApiError(400, "exercises must be an array");
  }

  return exercises.map((raw, index) => {
    const ex = raw as Record<string, unknown>;
    const exerciseId = (ex.exercise_template_id ?? ex.exerciseId) as string | undefined;
    if (!exerciseId) {
      throw new PublicApiError(400, `exercises[${index}] missing exercise_template_id`);
    }

    const setsRaw = ex.sets;
    if (!Array.isArray(setsRaw) || setsRaw.length === 0) {
      throw new PublicApiError(400, `exercises[${index}] needs at least one set`);
    }

    const sets = setsRaw.map((setRaw, setIndex) => {
      const set = setRaw as Record<string, unknown>;
      return {
        setNumber: Number(set.index ?? set.setNumber ?? setIndex + 1),
        weight: set.weight_kg != null ? Number(set.weight_kg) : set.weight != null ? Number(set.weight) : undefined,
        reps: set.reps != null ? Number(set.reps) : undefined,
        duration: set.duration_seconds != null ? Number(set.duration_seconds) : set.duration != null ? Number(set.duration) : undefined,
        rpe: set.rpe != null ? Number(set.rpe) : undefined,
        notes: typeof set.notes === "string" ? set.notes : undefined,
        setType: parseSetType(typeof set.type === "string" ? set.type : undefined),
        isCompleted: set.is_completed !== false,
      };
    });

    return {
      exerciseId,
      order: Number(ex.index ?? index),
      notes: typeof ex.notes === "string" ? ex.notes : undefined,
      sets,
    };
  });
}

const routes: Array<{
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}> = [
  {
    method: "GET",
    pattern: /^\/api\/v1\/user\/info$/,
    paramNames: [],
    handler: async (ctx, prisma) => {
      const workoutCount = await prisma.workout.count({
        where: { userId: ctx.user.id, finishedAt: { not: null } },
      });
      return {
        user: {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
          weight_unit: ctx.user.weightUnit.toLowerCase(),
          subscription_tier: ctx.user.subscriptionTier.toLowerCase(),
          member_since: ctx.user.createdAt.toISOString(),
          workout_count: workoutCount,
        },
      };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/workouts$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const { page, pageSize, skip } = parsePage(new URL(request.url));
      const where = { userId: ctx.user.id, finishedAt: { not: null } };
      const [total, rows] = await Promise.all([
        prisma.workout.count({ where }),
        prisma.workout.findMany({
          where,
          include: workoutInclude,
          orderBy: { finishedAt: "desc" },
          skip,
          take: pageSize,
        }),
      ]);
      return paginated(rows.map(serializeWorkout), page, pageSize, total);
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/workouts$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const body = (await request.json()) as { workout?: Record<string, unknown> };
      const workout = body.workout ?? (body as Record<string, unknown>);
      const title = (workout.title ?? workout.name ?? "Workout") as string;
      const startTime = workout.start_time ? new Date(String(workout.start_time)) : new Date();
      const endTime = workout.end_time ? new Date(String(workout.end_time)) : startTime;
      const exercises = workoutExerciseInput(workout.exercises);

      const created = await prisma.workout.create({
        data: {
          userId: ctx.user.id,
          name: title,
          notes: typeof workout.description === "string" ? workout.description : typeof workout.notes === "string" ? workout.notes : undefined,
          startedAt: startTime,
          finishedAt: endTime,
          exercises: {
            create: exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              order: ex.order,
              notes: ex.notes,
              sets: { create: ex.sets },
            })),
          },
        },
        include: workoutInclude,
      });

      for (const exercise of created.exercises) {
        const completed = exercise.sets.filter((s) => s.isCompleted);
        if (completed.length > 0) {
          await syncPersonalRecords(prisma, ctx.user.id, exercise.exerciseId, completed);
        }
      }

      return { workout: serializeWorkout(created) };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/workouts\/count$/,
    paramNames: [],
    handler: async (ctx, prisma) => ({
      workout_count: await prisma.workout.count({
        where: { userId: ctx.user.id, finishedAt: { not: null } },
      }),
    }),
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/workouts\/events$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const url = new URL(request.url);
      const sinceRaw = url.searchParams.get("since");
      if (!sinceRaw) {
        throw new PublicApiError(400, "since query parameter is required (ISO 8601)");
      }
      const since = parseDateParam(sinceRaw);
      const { page, pageSize, skip } = parsePage(url);

      const [updatedTotal, updated, deletedTotal, deleted] = await Promise.all([
        prisma.workout.count({ where: { userId: ctx.user.id, updatedAt: { gte: since } } }),
        prisma.workout.findMany({
          where: { userId: ctx.user.id, updatedAt: { gte: since } },
          include: workoutInclude,
          orderBy: { updatedAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.workoutDeletionLog.count({ where: { userId: ctx.user.id, deletedAt: { gte: since } } }),
        prisma.workoutDeletionLog.findMany({
          where: { userId: ctx.user.id, deletedAt: { gte: since } },
          orderBy: { deletedAt: "desc" },
          skip,
          take: pageSize,
        }),
      ]);

      const events = [
        ...updated.map((w) => ({
          type: w.createdAt >= since ? "created" : "updated",
          workout: serializeWorkout(w),
        })),
        ...deleted.map((d) => ({
          type: "deleted",
          workout_id: d.workoutId,
          deleted_at: d.deletedAt.toISOString(),
        })),
      ].sort((a, b) => {
        const ta = "deleted_at" in a ? a.deleted_at : a.workout.end_time ?? a.workout.start_time ?? "";
        const tb = "deleted_at" in b ? b.deleted_at : b.workout.end_time ?? b.workout.start_time ?? "";
        return tb.localeCompare(ta);
      });

      return paginated(events, page, pageSize, updatedTotal + deletedTotal);
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/workouts\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, _req, params) => {
      const workout = await prisma.workout.findFirst({
        where: { id: params.id, userId: ctx.user.id },
        include: workoutInclude,
      });
      if (!workout) throw new PublicApiError(404, "Workout not found");
      return { workout: serializeWorkout(workout) };
    },
  },
  {
    method: "PUT",
    pattern: /^\/api\/v1\/workouts\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, request, params) => {
      const existing = await prisma.workout.findFirst({
        where: { id: params.id, userId: ctx.user.id },
      });
      if (!existing) throw new PublicApiError(404, "Workout not found");

      const body = (await request.json()) as { workout?: Record<string, unknown> };
      const workout = body.workout ?? (body as Record<string, unknown>);

      if (workout.exercises) {
        await prisma.workoutExercise.deleteMany({ where: { workoutId: params.id } });
      }

      const updated = await prisma.workout.update({
        where: { id: params.id },
        data: {
          name: workout.title != null ? String(workout.title) : workout.name != null ? String(workout.name) : undefined,
          notes: workout.description != null ? String(workout.description) : workout.notes != null ? String(workout.notes) : undefined,
          startedAt: workout.start_time ? new Date(String(workout.start_time)) : undefined,
          finishedAt: workout.end_time ? new Date(String(workout.end_time)) : undefined,
          ...(workout.exercises
            ? {
                exercises: {
                  create: workoutExerciseInput(workout.exercises).map((ex) => ({
                    exerciseId: ex.exerciseId,
                    order: ex.order,
                    notes: ex.notes,
                    sets: { create: ex.sets },
                  })),
                },
              }
            : {}),
        },
        include: workoutInclude,
      });

      return { workout: serializeWorkout(updated) };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/routines$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const { page, pageSize, skip } = parsePage(new URL(request.url));
      const where = { userId: ctx.user.id };
      const [total, rows] = await Promise.all([
        prisma.routine.count({ where }),
        prisma.routine.findMany({
          where,
          include: routineInclude,
          orderBy: { updatedAt: "desc" },
          skip,
          take: pageSize,
        }),
      ]);
      return paginated(rows.map(serializeRoutine), page, pageSize, total);
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/routines$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const body = (await request.json()) as { routine?: Record<string, unknown> };
      const routine = body.routine ?? (body as Record<string, unknown>);
      const title = (routine.title ?? routine.name) as string | undefined;
      if (!title?.trim()) throw new PublicApiError(400, "routine.title is required");

      const exercises = routine.exercises ? workoutExerciseInput(routine.exercises) : [];
      const created = await prisma.routine.create({
        data: {
          userId: ctx.user.id,
          name: title.trim(),
          notes: typeof routine.notes === "string" ? routine.notes : undefined,
          folderId: typeof routine.folder_id === "string" ? routine.folder_id : undefined,
          exercises: {
            create: exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              order: ex.order,
              notes: ex.notes,
              sets: {
                create: ex.sets.map((set) => ({
                  setNumber: set.setNumber,
                  targetWeight: set.weight,
                  targetReps: set.reps,
                  targetDuration: set.duration,
                  setType: set.setType,
                })),
              },
            })),
          },
        },
        include: routineInclude,
      });
      return { routine: serializeRoutine(created) };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/routines\/search$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const q = new URL(request.url).searchParams.get("q")?.trim();
      if (!q) throw new PublicApiError(400, "q query parameter is required");
      const rows = await prisma.routine.findMany({
        where: { userId: ctx.user.id, name: { contains: q, mode: "insensitive" } },
        include: routineInclude,
        orderBy: { updatedAt: "desc" },
        take: 20,
      });
      return { routines: rows.map(serializeRoutine) };
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/routines\/([^/]+)\/exercises$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, request, params) => {
      const routine = await prisma.routine.findFirst({
        where: { id: params.id, userId: ctx.user.id },
        include: { exercises: true },
      });
      if (!routine) throw new PublicApiError(404, "Routine not found");

      const body = (await request.json()) as { exercise?: Record<string, unknown> };
      const payload = parseRoutineExercisePayload(body.exercise ? body : (body as Record<string, unknown>));
      const exercise = await resolveExercise(prisma, ctx.user.id, payload);

      const order = routine.exercises.length;
      const created = await prisma.routineExercise.create({
        data: {
          routineId: routine.id,
          exerciseId: exercise.id,
          order,
          notes: payload.notes,
          sets: { create: payload.sets },
        },
        include: {
          exercise: { select: { id: true, name: true } },
          sets: { orderBy: { setNumber: "asc" } },
        },
      });

      return {
        message: `Added ${exercise.name} to ${routine.name}`,
        routine_exercise: {
          id: created.id,
          routine_id: routine.id,
          exercise_template_id: exercise.id,
          exercise_name: exercise.name,
          index: created.order,
          sets: created.sets,
        },
      };
    },
  },
  {
    method: "PATCH",
    pattern: /^\/api\/v1\/routines\/([^/]+)\/exercises\/([^/]+)$/,
    paramNames: ["routineId", "routineExerciseId"],
    handler: async (ctx, prisma, request, params) => {
      const routineExercise = await prisma.routineExercise.findFirst({
        where: {
          id: params.routineExerciseId,
          routineId: params.routineId,
          routine: { userId: ctx.user.id },
        },
        include: { sets: true, exercise: true, routine: true },
      });
      if (!routineExercise) throw new PublicApiError(404, "Routine exercise not found");

      const body = (await request.json()) as { exercise?: Record<string, unknown> };
      const payload = parseRoutineExercisePayload(body.exercise ? body : (body as Record<string, unknown>));

      if (payload.sets.length > 0) {
        await prisma.routineSet.deleteMany({ where: { routineExerciseId: routineExercise.id } });
        await prisma.routineSet.createMany({
          data: payload.sets.map((set) => ({
            routineExerciseId: routineExercise.id,
            setNumber: set.setNumber,
            targetWeight: set.targetWeight,
            targetReps: set.targetReps,
            targetDuration: set.targetDuration,
            setType: set.setType,
          })),
        });
      }

      const updated = await prisma.routineExercise.update({
        where: { id: routineExercise.id },
        data: { notes: payload.notes ?? routineExercise.notes },
        include: {
          exercise: { select: { id: true, name: true } },
          sets: { orderBy: { setNumber: "asc" } },
          routine: { select: { id: true, name: true } },
        },
      });

      return {
        message: `Updated ${updated.exercise.name} in ${updated.routine.name}`,
        routine_exercise: updated,
      };
    },
  },
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/routines\/([^/]+)\/exercises\/([^/]+)$/,
    paramNames: ["routineId", "routineExerciseId"],
    handler: async (ctx, prisma, _req, params) => {
      const routineExercise = await prisma.routineExercise.findFirst({
        where: {
          id: params.routineExerciseId,
          routineId: params.routineId,
          routine: { userId: ctx.user.id },
        },
        include: { exercise: true, routine: true },
      });
      if (!routineExercise) throw new PublicApiError(404, "Routine exercise not found");

      await prisma.routineExercise.delete({ where: { id: routineExercise.id } });
      return {
        message: `Removed ${routineExercise.exercise.name} from ${routineExercise.routine.name}`,
        success: true,
      };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/routines\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, _req, params) => {
      const routine = await prisma.routine.findFirst({
        where: { id: params.id, userId: ctx.user.id },
        include: routineInclude,
      });
      if (!routine) throw new PublicApiError(404, "Routine not found");
      return { routine: serializeRoutine(routine) };
    },
  },
  {
    method: "PUT",
    pattern: /^\/api\/v1\/routines\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, request, params) => {
      const existing = await prisma.routine.findFirst({
        where: { id: params.id, userId: ctx.user.id },
      });
      if (!existing) throw new PublicApiError(404, "Routine not found");

      const body = (await request.json()) as { routine?: Record<string, unknown> };
      const routine = body.routine ?? (body as Record<string, unknown>);

      if (routine.exercises) {
        await prisma.routineExercise.deleteMany({ where: { routineId: params.id } });
      }

      const updated = await prisma.routine.update({
        where: { id: params.id },
        data: {
          name: routine.title != null ? String(routine.title) : routine.name != null ? String(routine.name) : undefined,
          notes: routine.notes != null ? String(routine.notes) : undefined,
          folderId: routine.folder_id != null ? String(routine.folder_id) : undefined,
          ...(routine.exercises
            ? {
                exercises: {
                  create: workoutExerciseInput(routine.exercises).map((ex) => ({
                    exerciseId: ex.exerciseId,
                    order: ex.order,
                    notes: ex.notes,
                    sets: {
                      create: ex.sets.map((set) => ({
                        setNumber: set.setNumber,
                        targetWeight: set.weight,
                        targetReps: set.reps,
                        targetDuration: set.duration,
                        setType: set.setType,
                      })),
                    },
                  })),
                },
              }
            : {}),
        },
        include: routineInclude,
      });
      return { routine: serializeRoutine(updated) };
    },
  },
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/routines\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, _req, params) => {
      const routine = await prisma.routine.findFirst({
        where: { id: params.id, userId: ctx.user.id },
        select: { id: true, name: true },
      });
      if (!routine) throw new PublicApiError(404, "Routine not found");

      await prisma.routine.delete({ where: { id: params.id } });
      return { message: `Deleted routine "${routine.name}"`, success: true };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/routine_folders$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const { page, pageSize, skip } = parsePage(new URL(request.url));
      const where = { userId: ctx.user.id };
      const [total, rows] = await Promise.all([
        prisma.routineFolder.count({ where }),
        prisma.routineFolder.findMany({ where, orderBy: { createdAt: "asc" }, skip, take: pageSize }),
      ]);
      return paginated(
        rows.map((f) => ({ id: f.id, title: f.name, created_at: f.createdAt.toISOString() })),
        page,
        pageSize,
        total,
      );
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/routine_folders$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const body = (await request.json()) as { routine_folder?: Record<string, unknown> };
      const folder = body.routine_folder ?? (body as Record<string, unknown>);
      const title = (folder.title ?? folder.name) as string | undefined;
      if (!title?.trim()) throw new PublicApiError(400, "routine_folder.title is required");
      const created = await prisma.routineFolder.create({
        data: { userId: ctx.user.id, name: title.trim() },
      });
      return { routine_folder: { id: created.id, title: created.name } };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/routine_folders\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, _req, params) => {
      const folder = await prisma.routineFolder.findFirst({
        where: { id: params.id, userId: ctx.user.id },
      });
      if (!folder) throw new PublicApiError(404, "Routine folder not found");
      return { routine_folder: { id: folder.id, title: folder.name } };
    },
  },
  {
    method: "PUT",
    pattern: /^\/api\/v1\/routine_folders\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, request, params) => {
      const folder = await prisma.routineFolder.findFirst({
        where: { id: params.id, userId: ctx.user.id },
      });
      if (!folder) throw new PublicApiError(404, "Routine folder not found");

      const body = (await request.json()) as { routine_folder?: Record<string, unknown> };
      const payload = body.routine_folder ?? (body as Record<string, unknown>);
      const title = (payload.title ?? payload.name) as string | undefined;
      if (!title?.trim()) throw new PublicApiError(400, "routine_folder.title is required");

      const updated = await prisma.routineFolder.update({
        where: { id: params.id },
        data: { name: title.trim() },
      });
      return { routine_folder: { id: updated.id, title: updated.name } };
    },
  },
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/routine_folders\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, _req, params) => {
      const folder = await prisma.routineFolder.findFirst({
        where: { id: params.id, userId: ctx.user.id },
        select: { id: true, name: true },
      });
      if (!folder) throw new PublicApiError(404, "Routine folder not found");

      await prisma.routineFolder.delete({ where: { id: params.id } });
      return { message: `Deleted folder "${folder.name}"`, success: true };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/exercise_templates$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const { page, pageSize, skip } = parsePage(new URL(request.url));
      const where = { OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }] };
      const [total, rows] = await Promise.all([
        prisma.exercise.count({ where }),
        prisma.exercise.findMany({
          where,
          include: exerciseInclude,
          orderBy: { name: "asc" },
          skip,
          take: pageSize,
        }),
      ]);
      return paginated(rows.map(serializeExerciseTemplate), page, pageSize, total);
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/exercise_templates$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const body = (await request.json()) as { exercise_template?: Record<string, unknown> };
      const template = body.exercise_template ?? (body as Record<string, unknown>);
      const title = (template.title ?? template.name) as string | undefined;
      if (!title?.trim()) throw new PublicApiError(400, "exercise_template.title is required");

      const created = await prisma.exercise.create({
        data: {
          name: title.trim(),
          instructions: typeof template.instructions === "string" ? template.instructions : undefined,
          isCustom: true,
          userId: ctx.user.id,
        },
        include: exerciseInclude,
      });
      return { exercise_template: serializeExerciseTemplate(created) };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/exercise_templates\/search$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const q = new URL(request.url).searchParams.get("q")?.trim();
      if (!q) throw new PublicApiError(400, "q query parameter is required");
      const rows = await prisma.exercise.findMany({
        where: {
          OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }],
          name: { contains: q, mode: "insensitive" },
        },
        include: exerciseInclude,
        orderBy: { name: "asc" },
        take: 20,
      });
      return { exercises: rows.map(serializeExerciseTemplate) };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/exercise_templates\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, _req, params) => {
      const exercise = await prisma.exercise.findFirst({
        where: {
          id: params.id,
          OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }],
        },
        include: exerciseInclude,
      });
      if (!exercise) throw new PublicApiError(404, "Exercise template not found");
      return { exercise_template: serializeExerciseTemplate(exercise) };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/exercise_history\/([^/]+)$/,
    paramNames: ["id"],
    handler: async (ctx, prisma, request, params) => {
      const { page, pageSize, skip } = parsePage(new URL(request.url));
      const where = {
        isCompleted: true,
        workoutExercise: {
          exerciseId: params.id,
          workout: { userId: ctx.user.id, finishedAt: { not: null } },
        },
      };
      const [total, sets] = await Promise.all([
        prisma.workoutSet.count({ where }),
        prisma.workoutSet.findMany({
          where,
          include: {
            workoutExercise: {
              include: { workout: { select: { id: true, finishedAt: true, name: true } } },
            },
          },
          orderBy: { workoutExercise: { workout: { finishedAt: "desc" } } },
          skip,
          take: pageSize,
        }),
      ]);

      return paginated(
        sets.map((set) => ({
          workout_id: set.workoutExercise.workout.id,
          workout_title: set.workoutExercise.workout.name,
          date: set.workoutExercise.workout.finishedAt?.toISOString() ?? null,
          weight_kg: set.weight,
          reps: set.reps,
          duration_seconds: set.duration,
          rpe: set.rpe,
          type: set.setType.toLowerCase(),
        })),
        page,
        pageSize,
        total,
      );
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/personal_records$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const url = new URL(request.url);
      const exerciseId = url.searchParams.get("exercise_template_id") ?? undefined;
      const { page, pageSize, skip } = parsePage(url);
      const where = { userId: ctx.user.id, ...(exerciseId ? { exerciseId } : {}) };
      const [total, rows] = await Promise.all([
        prisma.personalRecord.count({ where }),
        prisma.personalRecord.findMany({
          where,
          include: { exercise: { select: { id: true, name: true } } },
          orderBy: { achievedAt: "desc" },
          skip,
          take: pageSize,
        }),
      ]);
      return paginated(
        rows.map((pr) => ({
          id: pr.id,
          exercise_template_id: pr.exerciseId,
          exercise_name: pr.exercise.name,
          type: pr.type.toLowerCase(),
          value: pr.value,
          achieved_at: pr.achievedAt.toISOString(),
        })),
        page,
        pageSize,
        total,
      );
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/body_measurements$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const { page, pageSize, skip } = parsePage(new URL(request.url));
      const where = { userId: ctx.user.id };
      const [total, rows] = await Promise.all([
        prisma.bodyMeasurement.count({ where }),
        prisma.bodyMeasurement.findMany({ where, orderBy: { date: "desc" }, skip, take: pageSize }),
      ]);
      return paginated(rows.map(serializeMeasurement), page, pageSize, total);
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/body_measurements$/,
    paramNames: [],
    handler: async (ctx, prisma, request) => {
      const body = (await request.json()) as { body_measurement?: Record<string, unknown> };
      const m = body.body_measurement ?? (body as Record<string, unknown>);
      const dateRaw = m.date as string | undefined;
      const date = dateRaw ? parseDateParam(dateRaw) : new Date();
      const dayStart = new Date(`${dateOnly(date)}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateOnly(date)}T23:59:59.999Z`);

      const existing = await prisma.bodyMeasurement.findFirst({
        where: { userId: ctx.user.id, date: { gte: dayStart, lte: dayEnd } },
      });
      if (existing) throw new PublicApiError(409, "Body measurement already exists for this date");

      const created = await prisma.bodyMeasurement.create({
        data: {
          userId: ctx.user.id,
          date: dayStart,
          weight: m.weight_kg != null ? Number(m.weight_kg) : m.weight != null ? Number(m.weight) : undefined,
          bodyFat: m.body_fat_percentage != null ? Number(m.body_fat_percentage) : undefined,
          waist: m.waist_cm != null ? Number(m.waist_cm) : undefined,
          chest: m.chest_cm != null ? Number(m.chest_cm) : undefined,
          arms: m.arms_cm != null ? Number(m.arms_cm) : undefined,
        },
      });
      return { body_measurement: serializeMeasurement(created) };
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/body_measurements\/([^/]+)$/,
    paramNames: ["date"],
    handler: async (ctx, prisma, _req, params) => {
      const dayStart = new Date(`${params.date}T00:00:00.000Z`);
      const dayEnd = new Date(`${params.date}T23:59:59.999Z`);
      const row = await prisma.bodyMeasurement.findFirst({
        where: { userId: ctx.user.id, date: { gte: dayStart, lte: dayEnd } },
      });
      if (!row) throw new PublicApiError(404, "Body measurement not found");
      return { body_measurement: serializeMeasurement(row) };
    },
  },
  {
    method: "PUT",
    pattern: /^\/api\/v1\/body_measurements\/([^/]+)$/,
    paramNames: ["date"],
    handler: async (ctx, prisma, request, params) => {
      const dayStart = new Date(`${params.date}T00:00:00.000Z`);
      const dayEnd = new Date(`${params.date}T23:59:59.999Z`);
      const existing = await prisma.bodyMeasurement.findFirst({
        where: { userId: ctx.user.id, date: { gte: dayStart, lte: dayEnd } },
      });
      if (!existing) throw new PublicApiError(404, "Body measurement not found");

      const body = (await request.json()) as { body_measurement?: Record<string, unknown> };
      const m = body.body_measurement ?? (body as Record<string, unknown>);

      const updated = await prisma.bodyMeasurement.update({
        where: { id: existing.id },
        data: {
          weight: m.weight_kg != null ? Number(m.weight_kg) : m.weight != null ? Number(m.weight) : null,
          bodyFat: m.body_fat_percentage != null ? Number(m.body_fat_percentage) : null,
          waist: m.waist_cm != null ? Number(m.waist_cm) : null,
          chest: m.chest_cm != null ? Number(m.chest_cm) : null,
          arms: m.arms_cm != null ? Number(m.arms_cm) : null,
        },
      });
      return { body_measurement: serializeMeasurement(updated) };
    },
  },
];

export async function handlePublicApi(prisma: PrismaClient, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const route = routes.find((r) => r.method === request.method && r.pattern.test(pathname));
  if (!route) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  try {
    const ctx = await authenticateApiKey(prisma, request);
    const match = pathname.match(route.pattern);
    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      params[name] = match?.[i + 1] ?? "";
    });
    const data = await route.handler(ctx, prisma, request, params);
    return jsonResponse(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function logWorkoutDeletion(prisma: PrismaClient, userId: string, workoutId: string) {
  await prisma.workoutDeletionLog.create({ data: { userId, workoutId } });
}
