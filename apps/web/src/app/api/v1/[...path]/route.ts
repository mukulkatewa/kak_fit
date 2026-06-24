import { prisma } from "@kak-fit/db";
import { handlePublicApi } from "@kak-fit/api/public-api";

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const url = new URL(request.url);
  url.pathname = `/api/v1/${path.join("/")}`;
  const forwarded = new Request(url.toString(), request);
  return handlePublicApi(prisma, forwarded);
}

export async function GET(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function OPTIONS(request: Request, context: RouteContext) {
  return forward(request, context);
}
