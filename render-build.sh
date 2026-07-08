#!/usr/bin/env bash
set -e

echo "=== Installing pnpm ==="
npm_config_user_agent="pnpm/10.0.0" npx --yes pnpm@10 --version

echo "=== Installing dependencies ==="
npm_config_user_agent="pnpm/10.0.0" npx pnpm@10 install

echo "=== Building API server ==="
npm_config_user_agent="pnpm/10.0.0" npx pnpm@10 --filter @workspace/api-server run build

echo "=== Build complete ==="
