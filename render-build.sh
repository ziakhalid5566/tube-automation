#!/usr/bin/env bash
set -e

export CI=true

echo "=== Node version ==="
node --version

echo "=== npm version ==="
npm --version

echo "=== Enabling corepack ==="
corepack enable || true

echo "=== Installing dependencies via npx pnpm ==="
npx --yes pnpm@10 install

echo "=== pnpm version ==="
npx pnpm@10 --version

echo "=== Building API server ==="
npx pnpm@10 --filter @workspace/api-server run build

echo "=== Build complete ==="
