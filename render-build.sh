#!/usr/bin/env bash
set -e

export CI=true

echo "=== Node version ==="
node --version

echo "=== npm version ==="
npm --version

echo "=== Installing system packages (ffmpeg + espeak-ng) ==="
apt-get update -qq && apt-get install -y --no-install-recommends ffmpeg espeak-ng 2>&1 | tail -5 || echo "apt-get not available — skipping system packages"

echo "=== Verifying ffmpeg ==="
ffmpeg -version 2>&1 | head -1 || echo "WARNING: ffmpeg not found"

echo "=== Verifying espeak-ng ==="
espeak-ng --version 2>&1 | head -1 || echo "WARNING: espeak-ng not found"

echo "=== Installing dependencies via npx pnpm ==="
npx --yes pnpm@10 install --no-frozen-lockfile

echo "=== Building API server ==="
npx pnpm@10 --filter @workspace/api-server run build

echo "=== Build complete ==="
