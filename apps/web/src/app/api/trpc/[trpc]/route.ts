import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@kak-fit/api";
import { prisma } from "@kak-fit/db";
import { auth } from "@/lib/auth";

const createContext = async (opts: { req: Request }) => {
  const session = await auth.api.getSession({ headers: opts.req.headers });

  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null;

  const authHeader = opts.req.headers.get("authorization");
  const sessionToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

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
