#!/usr/bin/env bash
# Run the whole app locally for a demo: API (8000), web (3000) and the Reel worker (Docker).
# Usage: ./start-local.sh      Stop: Ctrl+C      (ports: WEB_PORT=3000 API_PORT=8000 by default)
# The web app runs as a production build (fast, no dev overlay) pointed at the local API.
set -euo pipefail
WEB_PORT="${WEB_PORT:-3000}"
API_PORT="${API_PORT:-8000}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

fail() { echo "✗ $1"; exit 1; }
command -v uv >/dev/null || fail "uv is missing. Install it: brew install uv"
command -v npm >/dev/null || fail "Node.js is missing. Install Node 20+ from https://nodejs.org"
command -v docker >/dev/null || fail "Docker is missing. Install Docker Desktop (the Reel maker runs in Docker)."
docker info >/dev/null 2>&1 || fail "Docker isn't running. Open Docker Desktop, wait for it to start, then try again."
[ -f api/.env ] || fail "api/.env is missing. Copy api/.env.example to api/.env and fill in the keys."
[ -f web/.env ] || [ -f web/.env.local ] || fail "web/.env is missing. Copy web/.env.example to web/.env and fill it in."
for port in "$WEB_PORT" "$API_PORT"; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    fail "Port $port is already in use (another dev server?). Stop it and try again."
  fi
done

echo "→ Preparing the Reel maker (first run downloads FFmpeg; can take a few minutes)…"
docker build -q -t t2c-api . >/dev/null

pids=()
# npx/uv start child processes; stop the whole tree so no server keeps the ports after Ctrl+C.
kill_tree() { local child; for child in $(pgrep -P "$1"); do kill_tree "$child"; done; kill "$1" 2>/dev/null || true; }
cleanup() {
  echo
  echo "→ Stopping…"
  docker rm -f t2c-worker >/dev/null 2>&1 || true
  for pid in "${pids[@]}"; do kill_tree "$pid"; done
}
trap cleanup EXIT INT TERM

docker rm -f t2c-worker >/dev/null 2>&1 || true
docker run -d --name t2c-worker --env-file api/.env t2c-api python /app/worker/main.py >/dev/null
# Environment variables override the .env files, so the web app and API point at each other on these ports.
(cd api && uv sync -q && CORS_ORIGINS="http://localhost:$WEB_PORT" exec uv run uvicorn app.main:app --port "$API_PORT" --log-level warning) &
pids+=($!)
echo "→ Building the web app (about a minute)…"
(cd web && npm install --silent --no-audit --no-fund \
  && NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" npx next build >/tmp/trend2cart-web.log 2>&1 \
  && exec npx next start --port "$WEB_PORT") >>/tmp/trend2cart-web.log 2>&1 &
pids+=($!)

for _ in $(seq 120); do
  curl -sf "localhost:$API_PORT/health" >/dev/null 2>&1 && curl -sf -o /dev/null "localhost:$WEB_PORT/sign-in" 2>/dev/null && break
  sleep 2
done
curl -sf "localhost:$API_PORT/health" >/dev/null || fail "The API didn't start. Check api/.env and the messages above."
curl -sf -o /dev/null "localhost:$WEB_PORT/sign-in" || fail "The web app didn't start. See /tmp/trend2cart-web.log"

echo
echo "✓ Trend2Cart is running → open http://localhost:$WEB_PORT"
echo "  (Tip: in Chrome press Cmd+Option+I, then the phone icon, to see the mobile view.)"
echo "  Reel maker logs follow below. Press Ctrl+C to stop everything."
echo
docker logs -f t2c-worker 2>&1 | grep --line-buffered -E "ready|started|done|failed|crashed" &
pids+=($!)
wait
