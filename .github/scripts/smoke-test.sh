#!/bin/sh
set -eu

image="$1"
name="guardian-smoke-$$"

docker run --rm -d --name "$name" -p 3000:3000 "$image" >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

for attempt in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1 \
    && curl -fsS http://127.0.0.1:3000/api/pg/health >/dev/null 2>&1; then
    echo "web ui responded"
    docker exec "$name" wget -qO- http://127.0.0.1:3001/health
    echo
    echo "api reachable through the web proxy"
    exit 0
  fi
  sleep 2
done

echo "guardian did not become healthy in time" >&2
docker logs "$name" >&2
exit 1
