import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@kak-fit/api";
import { prisma } from "@kak-fit/db";
import { auth } from "@/lib/auth";

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7);
  // DB stores token id; Better Auth bearer may send id.signature
  return raw.includes(".") ? raw.split(".")[0] : raw;
}

const createContext = async (opts: { req: Request }) => {
  let user = null;
  const sessionToken = extractBearerToken(opts.req);

  const session = await auth.api.getSession({ headers: opts.req.headers });
  if (session?.user?.id) {
    user = await prisma.user.findUnique({ where: { id: session.user.id } });
  }

  if (!user && sessionToken) {
    const dbSession = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });
    if (dbSession && dbSession.expiresAt > new Date()) {
      user = dbSession.user;
    }
  }

  return { prisma, user, sessionToken };
};

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
