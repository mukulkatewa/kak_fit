type JsonSchema = Record<string, unknown>;

function paginated(items: JsonSchema): JsonSchema {
  return {
    type: "object",
    properties: {
      page: { type: "integer" },
      page_size: { type: "integer" },
      page_count: { type: "integer" },
      total_count: { type: "integer" },
      data: { type: "array", items },
    },
  };
}

function pageParams() {
  return [
    { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number (1-based)" },
    {
      name: "pageSize",
      in: "query",
      schema: { type: "integer", default: 10, maximum: 50 },
      description: "Items per page (max 50)",
    },
  ];
}

function ok(schema: JsonSchema, extra?: Record<string, { description: string }>) {
  return {
    "200": {
      description: "Success",
      content: { "application/json": { schema } },
    },
    "401": { description: "Unauthorized — invalid or missing api-key" },
    "404": { description: "Not found" },
    ...extra,
  };
}

const workoutSetSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    index: { type: "integer" },
    weight_kg: { type: "number", nullable: true },
    reps: { type: "integer", nullable: true },
    duration_seconds: { type: "integer", nullable: true },
    rpe: { type: "number", nullable: true },
    notes: { type: "string", nullable: true },
    type: { type: "string", enum: ["normal", "warmup", "drop_set", "failure"] },
    is_completed: { type: "boolean" },
  },
};

const workoutSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string", nullable: true },
    start_time: { type: "string", format: "date-time", nullable: true },
    end_time: { type: "string", format: "date-time", nullable: true },
    duration_minutes: { type: "integer" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          exercise_template_id: { type: "string" },
          exercise_name: { type: "string" },
          notes: { type: "string", nullable: true },
          sets: { type: "array", items: workoutSetSchema },
        },
      },
    },
  },
};

const routineSetSchema: JsonSchema = {
  type: "object",
  properties: {
    index: { type: "integer" },
    weight_kg: { type: "number", nullable: true },
    reps: { type: "integer", nullable: true },
    duration_seconds: { type: "integer", nullable: true },
    type: { type: "string", enum: ["normal", "warmup", "drop_set", "failure"] },
  },
};

const routineSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    notes: { type: "string", nullable: true },
    folder_id: { type: "string", nullable: true },
    created_at: { type: "string", format: "date-time", nullable: true },
    updated_at: { type: "string", format: "date-time", nullable: true },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          exercise_template_id: { type: "string" },
          exercise_name: { type: "string" },
          notes: { type: "string", nullable: true },
          rest_seconds: { type: "integer", nullable: true },
          sets: { type: "array", items: routineSetSchema },
        },
      },
    },
  },
};

const exerciseTemplateSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    instructions: { type: "string", nullable: true },
    image_url: { type: "string", nullable: true },
    is_custom: { type: "boolean" },
    category: { type: "string", nullable: true },
    primary_muscles: { type: "array", items: { type: "string" } },
    secondary_muscles: { type: "array", items: { type: "string" } },
  },
};

const bodyMeasurementSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    date: { type: "string", format: "date" },
    weight_kg: { type: "number", nullable: true },
    body_fat_percentage: { type: "number", nullable: true },
    waist_cm: { type: "number", nullable: true },
    chest_cm: { type: "number", nullable: true },
    arms_cm: { type: "number", nullable: true },
  },
};

const workoutExerciseInput: JsonSchema = {
  type: "object",
  required: ["exercise_template_id", "sets"],
  properties: {
    exercise_template_id: { type: "string" },
    index: { type: "integer" },
    notes: { type: "string" },
    sets: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          weight_kg: { type: "number" },
          reps: { type: "integer" },
          duration_seconds: { type: "integer" },
          rpe: { type: "number" },
          notes: { type: "string" },
          type: { type: "string", enum: ["normal", "warmup", "drop_set", "failure"] },
          is_completed: { type: "boolean" },
        },
      },
    },
  },
};

const routineExerciseInput: JsonSchema = {
  type: "object",
  properties: {
    exercise_template_id: { type: "string", description: "Exercise catalog ID" },
    exercise_name: { type: "string", description: "Fuzzy name match — no ID needed" },
    notes: { type: "string" },
    sets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          weight_kg: { type: "number" },
          reps: { type: "integer" },
          duration_seconds: { type: "integer" },
          type: { type: "string", enum: ["normal", "warmup", "drop_set", "failure"] },
        },
      },
    },
  },
};

const security = [{ ApiKeyAuth: [] as string[] }];

export function buildOpenApiDocument(baseUrl: string) {
  const apiRoot = `${baseUrl.replace(/\/$/, "")}/api/v1`;

  return {
    openapi: "3.0.3",
    info: {
      title: "Kak Fit API",
      version: "1.0.0",
      description:
        "Personal fitness REST API. Authenticate with an api-key header (kak_…). Generate keys in Kak Fit → Settings → Developer API.",
    },
    servers: [{ url: apiRoot }],
    security,
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "api-key",
          description: "Per-user API key prefixed with kak_",
        },
      },
    },
    paths: {
      "/user/info": {
        get: {
          summary: "Get authenticated user profile",
          operationId: "getUserInfo",
          security,
          responses: ok({
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string", nullable: true },
                  email: { type: "string" },
                  weight_unit: { type: "string", enum: ["kg", "lb"] },
                  subscription_tier: { type: "string" },
                  member_since: { type: "string", format: "date-time" },
                  workout_count: { type: "integer" },
                },
              },
            },
          }),
        },
      },
      "/workouts": {
        get: {
          summary: "List completed workouts",
          operationId: "listWorkouts",
          security,
          parameters: pageParams(),
          responses: ok(paginated(workoutSchema)),
        },
        post: {
          summary: "Log a completed workout",
          operationId: "createWorkout",
          security,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    workout: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        start_time: { type: "string", format: "date-time" },
                        end_time: { type: "string", format: "date-time" },
                        exercises: { type: "array", items: workoutExerciseInput },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: { workout: workoutSchema },
          }),
        },
      },
      "/workouts/count": {
        get: {
          summary: "Get total completed workout count",
          operationId: "listWorkoutsCount",
          security,
          responses: ok({
            type: "object",
            properties: { workout_count: { type: "integer" } },
          }),
        },
      },
      "/workouts/events": {
        get: {
          summary: "List workout create/update/delete events since a timestamp",
          operationId: "listWorkoutEvents",
          security,
          parameters: [
            {
              name: "since",
              in: "query",
              required: true,
              schema: { type: "string", format: "date-time" },
              description: "ISO 8601 timestamp — return events on or after this time",
            },
            ...pageParams(),
          ],
          responses: ok(
            paginated({
              type: "object",
              properties: {
                type: { type: "string", enum: ["created", "updated", "deleted"] },
                workout: workoutSchema,
                workout_id: { type: "string" },
                deleted_at: { type: "string", format: "date-time" },
              },
            }),
          ),
        },
      },
      "/workouts/{workoutId}": {
        get: {
          summary: "Get a workout by ID",
          operationId: "getWorkout",
          security,
          parameters: [{ name: "workoutId", in: "path", required: true, schema: { type: "string" } }],
          responses: ok({
            type: "object",
            properties: { workout: workoutSchema },
          }),
        },
        put: {
          summary: "Update a workout (replaces exercises when exercises array is sent)",
          operationId: "updateWorkout",
          security,
          parameters: [{ name: "workoutId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    workout: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        start_time: { type: "string", format: "date-time" },
                        end_time: { type: "string", format: "date-time" },
                        exercises: { type: "array", items: workoutExerciseInput },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: { workout: workoutSchema },
          }),
        },
      },
      "/routines": {
        get: {
          summary: "List routines",
          operationId: "listRoutines",
          security,
          parameters: pageParams(),
          responses: ok(paginated(routineSchema)),
        },
        post: {
          summary: "Create a routine",
          operationId: "createRoutine",
          security,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["routine"],
                  properties: {
                    routine: {
                      type: "object",
                      required: ["title"],
                      properties: {
                        title: { type: "string" },
                        notes: { type: "string" },
                        folder_id: { type: "string" },
                        exercises: { type: "array", items: workoutExerciseInput },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: { routine: routineSchema },
          }),
        },
      },
      "/routines/search": {
        get: {
          summary: "Search routines by title",
          operationId: "searchRoutines",
          security,
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "Routine name search term",
            },
          ],
          responses: ok({
            type: "object",
            properties: {
              routines: { type: "array", items: routineSchema },
            },
          }),
        },
      },
      "/routines/{routineId}": {
        get: {
          summary: "Get a routine by ID",
          operationId: "getRoutine",
          security,
          parameters: [{ name: "routineId", in: "path", required: true, schema: { type: "string" } }],
          responses: ok({
            type: "object",
            properties: { routine: routineSchema },
          }),
        },
        put: {
          summary: "Update a routine (full replace when exercises array is sent)",
          operationId: "updateRoutine",
          security,
          parameters: [{ name: "routineId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    routine: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        notes: { type: "string" },
                        folder_id: { type: "string" },
                        exercises: { type: "array", items: workoutExerciseInput },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: { routine: routineSchema },
          }),
        },
        delete: {
          summary: "Delete a routine",
          operationId: "deleteRoutine",
          security,
          parameters: [{ name: "routineId", in: "path", required: true, schema: { type: "string" } }],
          responses: ok({
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          }),
        },
      },
      "/routines/{routineId}/exercises": {
        post: {
          summary: "Add an exercise to a routine",
          operationId: "addExerciseToRoutine",
          security,
          parameters: [{ name: "routineId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    exercise: routineExerciseInput,
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: {
              message: { type: "string" },
              routine_exercise: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  routine_id: { type: "string" },
                  exercise_template_id: { type: "string" },
                  exercise_name: { type: "string" },
                  index: { type: "integer" },
                  sets: { type: "array", items: routineSetSchema },
                },
              },
            },
          }),
        },
      },
      "/routines/{routineId}/exercises/{routineExerciseId}": {
        patch: {
          summary: "Update sets or notes for a routine exercise",
          operationId: "updateRoutineExercise",
          security,
          parameters: [
            { name: "routineId", in: "path", required: true, schema: { type: "string" } },
            { name: "routineExerciseId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    exercise: routineExerciseInput,
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: {
              message: { type: "string" },
              routine_exercise: { type: "object" },
            },
          }),
        },
        delete: {
          summary: "Remove an exercise from a routine",
          operationId: "deleteExerciseFromRoutine",
          security,
          parameters: [
            { name: "routineId", in: "path", required: true, schema: { type: "string" } },
            { name: "routineExerciseId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: ok({
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          }),
        },
      },
      "/routine_folders": {
        get: {
          summary: "List routine folders",
          operationId: "listRoutineFolders",
          security,
          parameters: pageParams(),
          responses: ok(
            paginated({
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                created_at: { type: "string", format: "date-time" },
              },
            }),
          ),
        },
        post: {
          summary: "Create a routine folder",
          operationId: "createRoutineFolder",
          security,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["routine_folder"],
                  properties: {
                    routine_folder: {
                      type: "object",
                      required: ["title"],
                      properties: { title: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: {
              routine_folder: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                },
              },
            },
          }),
        },
      },
      "/routine_folders/{folderId}": {
        get: {
          summary: "Get a routine folder",
          operationId: "getRoutineFolder",
          security,
          parameters: [{ name: "folderId", in: "path", required: true, schema: { type: "string" } }],
          responses: ok({
            type: "object",
            properties: {
              routine_folder: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                },
              },
            },
          }),
        },
        put: {
          summary: "Rename a routine folder",
          operationId: "updateRoutineFolder",
          security,
          parameters: [{ name: "folderId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["routine_folder"],
                  properties: {
                    routine_folder: {
                      type: "object",
                      required: ["title"],
                      properties: { title: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: {
              routine_folder: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                },
              },
            },
          }),
        },
        delete: {
          summary: "Delete a routine folder",
          operationId: "deleteRoutineFolder",
          security,
          parameters: [{ name: "folderId", in: "path", required: true, schema: { type: "string" } }],
          responses: ok({
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          }),
        },
      },
      "/exercise_templates": {
        get: {
          summary: "List exercise templates",
          operationId: "listExerciseTemplates",
          security,
          parameters: pageParams(),
          responses: ok(paginated(exerciseTemplateSchema)),
        },
        post: {
          summary: "Create a custom exercise template",
          operationId: "createExerciseTemplate",
          security,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["exercise_template"],
                  properties: {
                    exercise_template: {
                      type: "object",
                      required: ["title"],
                      properties: {
                        title: { type: "string" },
                        instructions: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: { exercise_template: exerciseTemplateSchema },
          }),
        },
      },
      "/exercise_templates/search": {
        get: {
          summary: "Search exercise templates by name",
          operationId: "searchExerciseTemplates",
          security,
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "Exercise name search term",
            },
          ],
          responses: ok({
            type: "object",
            properties: {
              exercises: { type: "array", items: exerciseTemplateSchema },
            },
          }),
        },
      },
      "/exercise_templates/{exerciseTemplateId}": {
        get: {
          summary: "Get an exercise template by ID",
          operationId: "getExerciseTemplate",
          security,
          parameters: [
            { name: "exerciseTemplateId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: ok({
            type: "object",
            properties: { exercise_template: exerciseTemplateSchema },
          }),
        },
      },
      "/exercise_history/{exerciseTemplateId}": {
        get: {
          summary: "Get completed set history for an exercise",
          operationId: "getExerciseHistory",
          security,
          parameters: [
            { name: "exerciseTemplateId", in: "path", required: true, schema: { type: "string" } },
            ...pageParams(),
          ],
          responses: ok(
            paginated({
              type: "object",
              properties: {
                workout_id: { type: "string" },
                workout_title: { type: "string" },
                date: { type: "string", format: "date-time", nullable: true },
                weight_kg: { type: "number", nullable: true },
                reps: { type: "integer", nullable: true },
                duration_seconds: { type: "integer", nullable: true },
                rpe: { type: "number", nullable: true },
                type: { type: "string" },
              },
            }),
          ),
        },
      },
      "/personal_records": {
        get: {
          summary: "List personal records",
          operationId: "listPersonalRecords",
          security,
          parameters: [
            {
              name: "exercise_template_id",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Filter PRs to a single exercise",
            },
            ...pageParams(),
          ],
          responses: ok(
            paginated({
              type: "object",
              properties: {
                id: { type: "string" },
                exercise_template_id: { type: "string" },
                exercise_name: { type: "string" },
                type: { type: "string" },
                value: { type: "number" },
                achieved_at: { type: "string", format: "date-time" },
              },
            }),
          ),
        },
      },
      "/body_measurements": {
        get: {
          summary: "List body measurements",
          operationId: "listBodyMeasurements",
          security,
          parameters: pageParams(),
          responses: ok(paginated(bodyMeasurementSchema)),
        },
        post: {
          summary: "Create a body measurement",
          operationId: "createBodyMeasurement",
          security,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    body_measurement: {
                      type: "object",
                      properties: {
                        date: { type: "string", format: "date" },
                        weight_kg: { type: "number" },
                        body_fat_percentage: { type: "number" },
                        waist_cm: { type: "number" },
                        chest_cm: { type: "number" },
                        arms_cm: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: ok(
            {
              type: "object",
              properties: { body_measurement: bodyMeasurementSchema },
            },
            { "409": { description: "Body measurement already exists for this date" } },
          ),
        },
      },
      "/body_measurements/{date}": {
        get: {
          summary: "Get body measurement for a date",
          operationId: "getBodyMeasurement",
          security,
          parameters: [
            {
              name: "date",
              in: "path",
              required: true,
              schema: { type: "string", format: "date" },
              description: "Date in YYYY-MM-DD format",
            },
          ],
          responses: ok({
            type: "object",
            properties: { body_measurement: bodyMeasurementSchema },
          }),
        },
        put: {
          summary: "Update body measurement for a date",
          operationId: "updateBodyMeasurement",
          security,
          parameters: [
            {
              name: "date",
              in: "path",
              required: true,
              schema: { type: "string", format: "date" },
              description: "Date in YYYY-MM-DD format",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    body_measurement: {
                      type: "object",
                      properties: {
                        weight_kg: { type: "number" },
                        body_fat_percentage: { type: "number" },
                        waist_cm: { type: "number" },
                        chest_cm: { type: "number" },
                        arms_cm: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: ok({
            type: "object",
            properties: { body_measurement: bodyMeasurementSchema },
          }),
        },
      },
    },
  };
}
