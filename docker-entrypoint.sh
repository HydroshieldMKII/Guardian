#!/bin/sh
set -eu

# Adopt volume created by an earlier root-only release, then drop privileges
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/data
  exec su-exec node "$0" "$@"
fi

api_pid=""
web_pid=""

shutdown() {
  trap - TERM INT
  [ -n "$api_pid" ] && kill -TERM "$api_pid" 2>/dev/null || true
  [ -n "$web_pid" ] && kill -TERM "$web_pid" 2>/dev/null || true
  wait 2>/dev/null || true
}

trap shutdown TERM INT

cd /app/backend
node dist/main &
api_pid=$!

cd /app/frontend
node server.js &
web_pid=$!

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null; do
  sleep 1
done

if ! kill -0 "$api_pid" 2>/dev/null; then
  echo "guardian: api process exited, shutting down container" >&2
else
  echo "guardian: web process exited, shutting down container" >&2
fi

shutdown
exit 1
