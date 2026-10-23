#!/bin/sh
# Free tier: run the Reel worker in the background next to the API (Render has no free worker plan).
cd /app/worker && python main.py &
cd /app/api && exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
