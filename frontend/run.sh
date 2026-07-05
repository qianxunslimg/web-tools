#!/bin/sh
set -eu

api_base="${VITE_API_BASE:-}"

cat > /usr/share/nginx/html/env.js <<EOF
window.__ENV__ = {
  VITE_API_BASE: "${api_base}"
};
EOF

exec nginx -g "daemon off;"
