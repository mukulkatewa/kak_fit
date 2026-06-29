const required = {
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};

for (const [key, value] of Object.entries(required)) {
  if (!value) {
    console.error(`[kak-fit] MISSING REQUIRED ENV VAR: ${key}`);
    // Don't throw in production to avoid crash loops — just log
  }
}

export function getAuthEnvStatus(): "configured" | "missing BETTER_AUTH_SECRET" {
  return process.env.BETTER_AUTH_SECRET ? "configured" : "missing BETTER_AUTH_SECRET";
}
