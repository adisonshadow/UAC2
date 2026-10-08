#!/bin/sh
set -eu

LISTEN_PORT="${LISTEN_PORT:-13308}"
FPCU2_BFF_UPSTREAM="${FPCU2_BFF_UPSTREAM:-fpcu2-bff:13303}"
# 只注入端口与应用 ID；浏览器用当前 hostname 拼 EADAF 地址
EADAF_WEB_HOST_PORT="${EADAF_WEB_HOST_PORT:-9527}"
FPCU2_SSO_APPLICATION_ID="${FPCU2_SSO_APPLICATION_ID:-10000000-0001-4000-8000-000000006666}"

export LISTEN_PORT FPCU2_BFF_UPSTREAM

# 仅当显式 FORCE 时才写入绝对 eadafPublicUrl（特殊反代）；默认跟随浏览器 Host
if [ "${EADAF_PUBLIC_URL_FORCE:-}" = "1" ] && [ -n "${EADAF_PUBLIC_URL:-}" ]; then
  cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__EADAF_DEPLOY__ = {
  eadafPublicUrl: "${EADAF_PUBLIC_URL}",
  eadafWebPort: "${EADAF_WEB_HOST_PORT}",
  ssoApplicationId: "${FPCU2_SSO_APPLICATION_ID}"
};
EOF
else
  cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__EADAF_DEPLOY__ = {
  eadafWebPort: "${EADAF_WEB_HOST_PORT}",
  ssoApplicationId: "${FPCU2_SSO_APPLICATION_ID}"
};
EOF
fi

envsubst '${LISTEN_PORT} ${FPCU2_BFF_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec "$@"
