# Performance

## Database connection pooling

Kak Fit uses **Prisma** with optional **Prisma Accelerate** for query caching and managed pooling in production.

### Connection URL parameters

For direct PostgreSQL connections (`postgresql://…`), pool settings are applied via query parameters on `DATABASE_URL`:

| Parameter | Env override | Default | Purpose |
|-----------|----------------|---------|---------|
| `connection_limit` | `DATABASE_CONNECTION_LIMIT` or `DATABASE_POOL_SIZE` | `10` | Max connections per Prisma Client instance |
| `pool_timeout` | `DATABASE_POOL_TIMEOUT` | `20` | Seconds to wait for a free connection |

Example:

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&connection_limit=15&pool_timeout=20"
DATABASE_POOL_TIMEOUT=20
DATABASE_POOL_SIZE=10
DATABASE_CONNECTION_LIMIT=15
```

`packages/db/src/index.ts` merges env defaults into `DATABASE_URL` when those query params are not already present.

### Prisma Accelerate

When `DATABASE_URL` uses a `prisma://` or `prisma+postgres://` URL, pooling is handled by Accelerate; local `connection_limit` params are not injected.

### Serverless (Vercel)

Each serverless function instance creates its own Prisma Client (singleton per instance via `globalThis` in development). Keep `connection_limit` modest (5–15) so concurrent instances do not exhaust Postgres `max_connections`. Supabase session pooler (`:5432` or `:6543`) is recommended for production.

### Slow query monitoring

A Prisma extension logs warnings for operations taking longer than **1s**:

```
[Prisma] Slow query detected: Workout.findMany took 1240ms
```

In development, Prisma also logs all queries (`log: ['query', 'error', 'warn']`).

### Graceful shutdown

On Node runtimes, `packages/db` registers `SIGTERM`, `SIGINT`, and `beforeExit` handlers that call `prisma.$disconnect()`. This applies to the Next.js API server and long-running processes.

**Note:** Next.js Edge Middleware (`apps/web/src/middleware.ts`) does not run in Node and cannot host `process.on` handlers; shutdown is registered where the Prisma client is instantiated.

### Related optimizations

- Workout history uses lightweight selects + Prisma Accelerate cache (`ttl: 60`, `swr: 300`)
- Composite indexes on high-traffic tables (`userId`, `finishedAt`, etc.) — see `packages/db/prisma/schema.prisma`
- tRPC session cache uses LRU eviction to avoid unbounded memory growth on the web API
- Personal records use O(n) single-pass recalculation and O(1) incremental updates on set edits (`packages/api/src/services/personal-records.ts`)
