#!/usr/bin/env bash
set -e

export CI=true

echo "=== Node version ==="
node --version

echo "=== Installing pnpm ==="
npm install -g pnpm@10

echo "=== pnpm version ==="
pnpm --version

echo "=== Installing dependencies ==="
pnpm install

echo "=== Building API server ==="
pnpm --filter @workspace/api-server run build

echo "=== Build complete ==="
