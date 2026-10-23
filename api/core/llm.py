"""The one LLM entry point. Talks to any OpenAI-compatible chat API (Gemini by default).

Callers get plain text or a parsed JSON dict; provider details stay in this file.
"""

import json
import re

import httpx

from core.config import get_settings


class LLMError(Exception):
    """Message is safe to show to sellers."""


RETRYABLE = {429, 500, 502, 503, 504}


def complete(system: str, user: str, temperature: float = 0.7) -> str:
    """Try the main model, then each fallback model when one is busy or the network drops."""
    settings = get_settings()
    if not settings.llm_api_key:
        raise LLMError("Our writing assistant isn't set up yet. Please try again later.")
    models = [settings.llm_model] + [m.strip() for m in settings.llm_fallback_models.split(",") if m.strip()]
    busy = False
    for model in models:
        try:
            resp = httpx.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key}"},
                json={
                    "model": model,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    "temperature": temperature,
                },
                timeout=60,
            )
        except httpx.HTTPError:
            continue
        if resp.status_code in RETRYABLE:
            busy = True
            continue
        if resp.is_error:
            raise LLMError("Our writing assistant had a problem. Please try again.")
        try:
            return resp.json()["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError, ValueError):
            raise LLMError("Our writing assistant sent back an empty answer. Please try again.")
    if busy:
        raise LLMError("Our writing assistant is busy right now. Please try again in a minute.")
    raise LLMError("We couldn't reach our writing assistant. Please try again in a minute.")


def _parse_json(text: str) -> dict:
    # Models often wrap JSON in ```json fences; take the outermost {...}.
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON object")
    return json.loads(match.group(0))


def complete_json(system: str, user: str, temperature: float = 0.7) -> dict:
    """Like complete(), but returns a dict. Retries once if the model's JSON is malformed."""
    system = system + "\n\nReply with a single JSON object only. No markdown, no explanation."
    for _ in range(2):
        try:
            return _parse_json(complete(system, user, temperature))
        except (ValueError, json.JSONDecodeError):
            continue
    raise LLMError("Our writing assistant gave an unclear answer. Please try again.")
