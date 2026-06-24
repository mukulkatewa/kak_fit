import { PublicApiError } from "./auth";

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof PublicApiError) {
    return jsonResponse({ error: error.message }, error.status);
  }
  if (error instanceof Error && error.message === "Invalid date") {
    return jsonResponse({ error: error.message }, 400);
  }
  console.error("[public-api]", error);
  return jsonResponse({ error: "Internal server error" }, 500);
}
