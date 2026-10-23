#!/bin/sh
# Free tier: run the Reel worker in the background next to the API (Render has no free worker plan).
# Restart the worker if it ever exits, so queued Reels don't wait forever.
(cd /app/worker && while true; do python main.py; echo "worker exited; restarting in 5s"; sleep 5; done) &
cd /app/api && exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
