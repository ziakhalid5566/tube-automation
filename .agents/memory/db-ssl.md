---
name: DB SSL requirement
description: Render external PostgreSQL requires SSL; the pg Pool must enable it
---

## Rule
When `NODE_ENV=production` or `DATABASE_SSL=true`, the pg Pool must set `ssl: { rejectUnauthorized: false }`.

**Why:** Render's external PostgreSQL connection string points to `*.oregon-postgres.render.com` which requires SSL. Without it, all queries fail silently (connection refused or handshake error) and all route handlers return 500.

**How to apply:**
```ts
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" || process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});
```

Also set `DATABASE_SSL=true` as an env var on the Render service.
