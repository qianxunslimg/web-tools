#!/bin/sh
set -eu

hash_file="node_modules/.qianxun-package-lock-hash"
lock_hash="$(sha256sum package-lock.json | awk '{print $1}')"
current_hash=""
npm_registry="https://registry.npmmirror.com"

npm config set registry "$npm_registry" >/dev/null

if [ -f "$hash_file" ]; then
  current_hash="$(cat "$hash_file")"
fi

if [ ! -x node_modules/.bin/vite ] || [ "$current_hash" != "$lock_hash" ]; then
  npm ci --no-audit --no-fund --registry="$npm_registry"
  mkdir -p node_modules
  printf "%s" "$lock_hash" > "$hash_file"
fi

exec npm run dev -- --host 0.0.0.0 --port 80
