#!/bin/sh
set -e

# Generate config.json from environment variables in /tmp (writable even in read-only K8s)
cat > /tmp/config.json <<EOF
{
  "api_url": "${API_URL:-}",
  "onesignal_app_id": "${ONESIGNAL_APP_ID:-}"
}
EOF

echo "Generated /tmp/config.json with:"
echo "  api_url: ${API_URL:-<not set>}"
echo "  onesignal_app_id: ${ONESIGNAL_APP_ID:-<not set>}"

# Execute Caddy
exec "$@"
