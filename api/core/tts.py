"""The one TTS entry point: text in a seller's language -> MP3 bytes.

Provider chosen by TTS_PROVIDER: "sarvam" (default, free credits) or "google" (free monthly quota).
"""

import base64

import httpx

from core.config import get_settings

LANGUAGE_CODES = {"ml": "ml-IN", "hi": "hi-IN", "en": "en-IN"}


class TTSError(Exception):
    """Message is safe to show to sellers."""


def _sarvam(text: str, language_code: str, key: str) -> bytes:
    resp = httpx.post(
        "https://api.sarvam.ai/text-to-speech",
        headers={"api-subscription-key": key},
        json={"text": text, "language_code": language_code, "model": "bulbul:v3", "output_audio_codec": "mp3"},
        timeout=60,
    )
    resp.raise_for_status()
    return base64.b64decode(resp.json()["audios"][0])


def _google(text: str, language_code: str, key: str) -> bytes:
    resp = httpx.post(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        params={"key": key},
        json={
            "input": {"text": text},
            "voice": {"languageCode": language_code},
            "audioConfig": {"audioEncoding": "MP3"},
        },
        timeout=60,
    )
    resp.raise_for_status()
    return base64.b64decode(resp.json()["audioContent"])


def synthesize(text: str, language: str) -> bytes:
    """language: "ml", "hi" or "en". Returns MP3 bytes."""
    if language not in LANGUAGE_CODES:
        raise TTSError("This language isn't supported yet. Please pick Malayalam, Hindi or English.")
    settings = get_settings()
    provider = settings.tts_provider
    providers = {"sarvam": (_sarvam, settings.sarvam_api_key), "google": (_google, settings.google_tts_api_key)}
    if provider not in providers or not providers[provider][1]:
        raise TTSError("Voiceover isn't set up yet. Please try again later.")
    synth, key = providers[provider]
    for attempt in range(2):  # one retry: free-tier APIs occasionally time out or return 5xx
        try:
            return synth(text, LANGUAGE_CODES[language], key)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise TTSError("Voiceover is busy right now. Please try again in a minute.")
            if e.response.status_code < 500 or attempt == 1:
                raise TTSError("We couldn't create the voiceover. Please try again.")
        except httpx.TransportError:
            if attempt == 1:
                raise TTSError("We couldn't reach the voiceover service. Please try again in a minute.")
        except (KeyError, IndexError, ValueError):
            raise TTSError("We couldn't create the voiceover. Please try again.")
