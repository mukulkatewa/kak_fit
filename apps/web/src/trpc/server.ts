import { appRouter, createTRPCContext } from "@kak-fit/api";

export async function getApiCaller() {
  const ctx = await createTRPCContext();
  return appRouter.createCaller(ctx);
}
