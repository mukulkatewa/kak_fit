import { apiHeaders, getApiUrl } from "./api-client";
import { clearToken, getToken } from "./auth";
import { authClient } from "./auth-client";
import { createTRPCClient } from "./trpc";

// Keep API-dependent orchestration above credential helpers: tRPC itself uses
// auth.ts to attach/refresh tokens and must not be imported back into auth.ts.
export async function signOut() {
  const token = await getToken();
  const signOutErrors: string[] = [];

  if (token) {
    await createTRPCClient()
      .auth.signOut.mutate()
      .catch((err: unknown) => {
        signOutErrors.push(`tRPC: ${err instanceof Error ? err.message : String(err)}`);
      });

    await fetch(`${getApiUrl()}/api/auth/sign-out`, {
      method: "POST",
      headers: apiHeaders({
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }),
      body: "{}",
    }).catch((err: unknown) => {
      signOutErrors.push(`API: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  await authClient.signOut().catch((err: unknown) => {
    signOutErrors.push(`Client: ${err instanceof Error ? err.message : String(err)}`);
  });

  await clearToken();

  if (signOutErrors.length > 0) {
    console.warn("[Auth] Sign-out had server-side errors (local session cleared):", signOutErrors);
  }
}
