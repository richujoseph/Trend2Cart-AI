# API + Reel worker in one container, because Render's free plan has no background workers.
FROM python:3.11-slim

# Debian's ffmpeg includes libass + harfbuzz (Malayalam captions); libfribidi0 enables Pillow's raqm.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg libfribidi0 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.10.4 /uv /bin/uv

WORKDIR /app
COPY api/ api/
COPY worker/ worker/
COPY start.sh .
# The worker project installs the API (and core/) as an editable path dependency, so one venv serves both.
RUN cd worker && uv sync --frozen --no-dev
ENV PATH="/app/worker/.venv/bin:$PATH"

CMD ["sh", "/app/start.sh"]
