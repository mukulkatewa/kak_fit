import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    provider: "better-auth",
    signIn: "google",
    endpoints: {
      googleSignIn: "GET /api/auth/sign-in/social?provider=google",
      signOut: "POST /api/auth/sign-out",
      session: "GET /api/auth/get-session",
    },
  });
}
