#!/bin/sh
set -eu

LISTEN_PORT="${LISTEN_PORT:-13308}"
FPCU2_BFF_UPSTREAM="${FPCU2_BFF_UPSTREAM:-fpcu2-bff:13303}"
EADAF_PUBLIC_URL="${EADAF_PUBLIC_URL:-http://localhost:9527}"
FPCU2_SSO_APPLICATION_ID="${FPCU2_SSO_APPLICATION_ID:-10000000-0001-4000-8000-000000006666}"

export LISTEN_PORT FPCU2_BFF_UPSTREAM

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__EADAF_DEPLOY__ = {
  eadafPublicUrl: "${EADAF_PUBLIC_URL}",
  ssoApplicationId: "${FPCU2_SSO_APPLICATION_ID}"
};
EOF

envsubst '${LISTEN_PORT} ${FPCU2_BFF_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec "$@"
