---
name: Render deployment lessons
description: Key fixes needed to deploy a pnpm monorepo on Render free tier
---

## Rule
preinstall scripts that check `npm_config_user_agent` must be relaxed in CI, and `npm install -g` fails (permissions). Use `npx --yes pnpm@10` instead.

**Why:** Render's Node.js environment runs as non-root during app execution. The auto-deploy also re-uses the same build config, so any npm global install fails.

**How to apply:** Build command = `npx --yes pnpm@10 install --no-frozen-lockfile && npx pnpm@10 --filter @workspace/<artifact> run build`. Also change preinstall to `rm -f package-lock.json yarn.lock` (no pnpm enforcement).

## Additional
- `drizzle-kit push` is interactive — hangs in CI. Use raw SQL CREATE TABLE IF NOT EXISTS in server startup instead, or pass `--force`.
- Render env-vars `PUT` replaces ALL env vars — always include all vars in the array.
- Start command must use `.mjs` extension: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- The diagnostic trick: set build command to `echo TEST && node --version` — if it succeeds, environment works; failure is in our build script.
