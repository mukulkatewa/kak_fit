import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    provider: "better-auth",
    endpoints: {
      signIn: "POST /api/auth/sign-in/email",
      signUp: "POST /api/auth/sign-up/email",
      signOut: "POST /api/auth/sign-out",
      session: "GET /api/auth/get-session",
    },
    demo: { email: "demo@kakfit.app", password: "password123" },
  });
}
