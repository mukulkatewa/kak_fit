export function buildLlmTools(baseUrl: string) {
  const api = `${baseUrl}/api/v1`;

  const sharedFlows = `Always send the api-key header on every request.
Use exercise_name and routine title when possible so the user doesn't need IDs.

Key flows:
1. Add exercise by name: search_routines (GET ${api}/routines/search?q=Push) → add_exercise_to_routine (POST ${api}/routines/{routine_id}/exercises) with {"exercise":{"exercise_name":"Incline Bench Press","sets":[{"reps":10,"weight_kg":60}]}} — exercise_name fuzzy-matches the catalog; no ID needed.
2. Update sets: get_routine (GET ${api}/routines/{routine_id}) to find routine_exercise_id → update_routine_exercise (PATCH ${api}/routines/{routine_id}/exercises/{routine_exercise_id}).
3. Delete exercise from routine: get_routine → delete_exercise_from_routine (DELETE ${api}/routines/{routine_id}/exercises/{routine_exercise_id}).
4. Log a completed workout: create_workout (POST ${api}/workouts) with title, start_time, end_time, and exercises/sets.
5. Check progress: get_exercise_history (GET ${api}/exercise_history/{exercise_template_id}) or list_personal_records (GET ${api}/personal_records).
6. Find exercise IDs or confirm names: search_exercise_templates (GET ${api}/exercise_templates/search?q=bench).

Confirm what you changed in plain language after each mutation.`;

  const claudeOpenAiPrompt = `You are a fitness assistant with access to the user's Kak Fit account via REST API.
${sharedFlows}

Before any destructive mutation (delete_routine, delete_exercise_from_routine), confirm with the user in plain English what will be deleted and wait for approval unless they already explicitly asked for it.`;

  return {
    description:
      "Kak Fit personal fitness API. Each user has their own API key — it only accesses that user's workouts and routines.",
    auth: {
      header: "api-key",
      format: "kak_…",
      note: "Never expose keys in public repos. Get yours in Kak Fit → Settings → Developer API.",
    },
    base_url: api,
    gemini_system_prompt: `You are a fitness assistant with access to the user's Kak Fit account via REST API.
${sharedFlows}`,
    claude_system_prompt: claudeOpenAiPrompt,
    openai_system_prompt: claudeOpenAiPrompt,
    tools: [
      {
        name: "get_user_info",
        description: "Get the authenticated user's profile, units, subscription tier, and workout count",
        method: "GET",
        path: "/user/info",
      },
      {
        name: "list_workouts",
        description: "List completed workouts, newest first",
        method: "GET",
        path: "/workouts",
        query: { page: 1, pageSize: 20 },
      },
      {
        name: "get_workout",
        description: "Get a single workout with exercises and sets",
        method: "GET",
        path: "/workouts/{workout_id}",
      },
      {
        name: "list_workouts_count",
        description: "Get total count of completed workouts",
        method: "GET",
        path: "/workouts/count",
      },
      {
        name: "create_workout",
        description: "Log a completed workout. Use exercise_template_id or exercise_name per exercise.",
        method: "POST",
        path: "/workouts",
        body_example: {
          workout: {
            title: "Push Day",
            start_time: "2026-06-24T10:00:00Z",
            end_time: "2026-06-24T11:00:00Z",
            exercises: [
              {
                exercise_name: "Bench Press",
                sets: [{ reps: 8, weight_kg: 80 }, { reps: 8, weight_kg: 80 }],
              },
            ],
          },
        },
      },
      {
        name: "update_workout",
        description: "Update an existing workout (full replace of exercises/sets when provided)",
        method: "PUT",
        path: "/workouts/{workout_id}",
        body_example: {
          workout: {
            title: "Push Day",
            exercises: [{ exercise_name: "Bench Press", sets: [{ reps: 10, weight_kg: 75 }] }],
          },
        },
      },
      {
        name: "list_routines",
        description: "List the user's workout routines",
        method: "GET",
        path: "/routines",
        query: { page: 1, pageSize: 20 },
      },
      {
        name: "search_routines",
        description: "Find a routine by name (e.g. Push Day)",
        method: "GET",
        path: "/routines/search",
        query: { q: "routine name" },
      },
      {
        name: "get_routine",
        description: "Get full routine with exercises, routine_exercise_id values, and target sets",
        method: "GET",
        path: "/routines/{routine_id}",
      },
      {
        name: "create_routine",
        description: "Create a new routine with optional exercises and target sets",
        method: "POST",
        path: "/routines",
        body_example: {
          routine: {
            title: "Push Day",
            notes: "Chest, shoulders, triceps",
            exercises: [],
          },
        },
      },
      {
        name: "update_routine",
        description: "Update a routine (full replace when exercises array is provided)",
        method: "PUT",
        path: "/routines/{routine_id}",
        body_example: {
          routine: {
            title: "Push Day",
            notes: "Updated notes",
            exercises: [{ exercise_name: "Bench Press", sets: [{ reps: 8, weight_kg: 80 }] }],
          },
        },
      },
      {
        name: "delete_routine",
        description: "Permanently delete a routine",
        method: "DELETE",
        path: "/routines/{routine_id}",
      },
      {
        name: "add_exercise_to_routine",
        description:
          "Add an exercise to a routine by name. exercise_name fuzzy-matches the catalog — no ID needed.",
        method: "POST",
        path: "/routines/{routine_id}/exercises",
        body_example: {
          exercise: {
            exercise_name: "Bench Press",
            sets: [{ reps: 8, weight_kg: 80 }, { reps: 8, weight_kg: 80 }],
          },
        },
      },
      {
        name: "update_routine_exercise",
        description: "Update sets or notes for an exercise already in a routine",
        method: "PATCH",
        path: "/routines/{routine_id}/exercises/{routine_exercise_id}",
        body_example: {
          exercise: { sets: [{ reps: 10, weight_kg: 70 }] },
        },
      },
      {
        name: "delete_exercise_from_routine",
        description: "Remove an exercise from a routine (routine itself is kept)",
        method: "DELETE",
        path: "/routines/{routine_id}/exercises/{routine_exercise_id}",
      },
      {
        name: "list_exercise_templates",
        description: "List exercises in the catalog (built-in and user custom)",
        method: "GET",
        path: "/exercise_templates",
        query: { page: 1, pageSize: 50 },
      },
      {
        name: "search_exercise_templates",
        description: "Search exercises by name — use to find exercise_template_id or confirm spelling",
        method: "GET",
        path: "/exercise_templates/search",
        query: { q: "bench" },
      },
      {
        name: "get_exercise_history",
        description: "Get past sets for an exercise (by exercise_template_id)",
        method: "GET",
        path: "/exercise_history/{exercise_template_id}",
      },
      {
        name: "list_personal_records",
        description: "List personal records; optionally filter by exercise_template_id",
        method: "GET",
        path: "/personal_records",
        query: { exercise_template_id: "optional-exercise-id", page: 1, pageSize: 20 },
      },
      {
        name: "list_body_measurements",
        description: "List body measurements (weight, body fat, etc.), newest first",
        method: "GET",
        path: "/body_measurements",
        query: { page: 1, pageSize: 20 },
      },
      {
        name: "create_body_measurement",
        description: "Log a body measurement for a date (409 if date already exists — use update instead)",
        method: "POST",
        path: "/body_measurements",
        body_example: {
          body_measurement: { date: "2026-06-24", weight_kg: 80 },
        },
      },
      {
        name: "update_body_measurement",
        description: "Update body measurement for a specific date (YYYY-MM-DD)",
        method: "PUT",
        path: "/body_measurements/{date}",
        body_example: {
          body_measurement: { weight_kg: 79.5, body_fat_percentage: 15 },
        },
      },
    ],
  };
}
