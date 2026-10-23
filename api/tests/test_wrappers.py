import base64

import httpx
import pytest

from core import llm, tts
from core.config import get_settings


@pytest.fixture(autouse=True)
def settings(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
    monkeypatch.setenv("LLM_API_KEY", "llm-key")
    monkeypatch.setenv("SARVAM_API_KEY", "sarvam-key")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def fake_post(monkeypatch, module, status=200, body=None, calls=None):
    def post(url, **kwargs):
        if calls is not None:
            calls.append((url, kwargs))
        return httpx.Response(status, json=body or {}, request=httpx.Request("POST", url))

    monkeypatch.setattr(module.httpx, "post", post)


def chat(content):
    return {"choices": [{"message": {"content": content}}]}


def test_llm_uses_openai_compatible_request(monkeypatch):
    calls = []
    fake_post(monkeypatch, llm, body=chat(" Hello "), calls=calls)
    assert llm.complete("sys", "hi") == "Hello"
    url, kwargs = calls[0]
    assert url == "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    assert kwargs["headers"]["Authorization"] == "Bearer llm-key"
    assert kwargs["json"]["model"] == "gemini-3.5-flash-lite"
    assert kwargs["json"]["messages"][0] == {"role": "system", "content": "sys"}


def test_llm_provider_is_swappable_by_env(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://api.groq.com/openai/v1/")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    get_settings.cache_clear()
    calls = []
    fake_post(monkeypatch, llm, body=chat("ok"), calls=calls)
    llm.complete("s", "u")
    assert calls[0][0] == "https://api.groq.com/openai/v1/chat/completions"
    assert calls[0][1]["json"]["model"] == "llama-3.3-70b-versatile"


def test_llm_json_strips_markdown_fences(monkeypatch):
    fake_post(monkeypatch, llm, body=chat('```json\n{"stage": "clicks", "hooks": ["a"]}\n```'))
    assert llm.complete_json("s", "u") == {"stage": "clicks", "hooks": ["a"]}


def test_llm_json_gives_up_after_two_bad_answers(monkeypatch):
    calls = []
    fake_post(monkeypatch, llm, body=chat("not json"), calls=calls)
    with pytest.raises(llm.LLMError, match="unclear answer"):
        llm.complete_json("s", "u")
    assert len(calls) == 2


def test_llm_rate_limit_message(monkeypatch):
    calls = []
    fake_post(monkeypatch, llm, status=429, calls=calls)
    with pytest.raises(llm.LLMError, match="busy"):
        llm.complete("s", "u")
    assert [c[1]["json"]["model"] for c in calls] == ["gemini-3.5-flash-lite", "gemini-3.8-flash"]


def test_llm_falls_back_when_main_model_is_overloaded(monkeypatch):
    def post(url, **kwargs):
        status = 503 if kwargs["json"]["model"] == "gemini-3.5-flash-lite" else 200
        return httpx.Response(status, json=chat("ok from fallback"), request=httpx.Request("POST", url))

    monkeypatch.setattr(llm.httpx, "post", post)
    assert llm.complete("s", "u") == "ok from fallback"


def test_tts_retries_once_after_timeout(monkeypatch):
    attempts = []

    def post(url, **kwargs):
        attempts.append(1)
        if len(attempts) == 1:
            raise httpx.ReadTimeout("slow", request=httpx.Request("POST", url))
        return httpx.Response(200, json={"audios": [base64.b64encode(b"mp3").decode()]}, request=httpx.Request("POST", url))

    monkeypatch.setattr(tts.httpx, "post", post)
    assert tts.synthesize("hello", "en") == b"mp3"
    assert len(attempts) == 2


def test_llm_missing_key(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "")
    get_settings.cache_clear()
    with pytest.raises(llm.LLMError, match="isn't set up"):
        llm.complete("s", "u")


def test_tts_sarvam_returns_mp3_bytes(monkeypatch):
    calls = []
    fake_post(monkeypatch, tts, body={"audios": [base64.b64encode(b"ID3mp3").decode()]}, calls=calls)
    assert tts.synthesize("നമസ്കാരം", "ml") == b"ID3mp3"
    url, kwargs = calls[0]
    assert url == "https://api.sarvam.ai/text-to-speech"
    assert kwargs["json"]["language_code"] == "ml-IN"
    assert kwargs["json"]["output_audio_codec"] == "mp3"


def test_tts_google_provider(monkeypatch):
    monkeypatch.setenv("TTS_PROVIDER", "google")
    monkeypatch.setenv("GOOGLE_TTS_API_KEY", "g-key")
    get_settings.cache_clear()
    calls = []
    fake_post(monkeypatch, tts, body={"audioContent": base64.b64encode(b"mp3").decode()}, calls=calls)
    assert tts.synthesize("नमस्ते", "hi") == b"mp3"
    assert calls[0][1]["json"]["voice"]["languageCode"] == "hi-IN"


def test_tts_rejects_unsupported_language():
    with pytest.raises(tts.TTSError, match="isn't supported"):
        tts.synthesize("vanakkam", "ta")


def test_tts_error_is_seller_friendly(monkeypatch):
    fake_post(monkeypatch, tts, status=500)
    with pytest.raises(tts.TTSError, match="couldn't create the voiceover"):
        tts.synthesize("hello", "en")


def test_llm_hung_model_times_out_then_falls_back(monkeypatch):
    seen = []

    def post(url, **kwargs):
        seen.append((kwargs["json"]["model"], kwargs["timeout"]))
        if kwargs["json"]["model"] == "gemini-3.5-flash-lite":
            raise httpx.ReadTimeout("hung", request=httpx.Request("POST", url))
        return httpx.Response(200, json=chat("fallback answer"), request=httpx.Request("POST", url))

    monkeypatch.setattr(llm.httpx, "post", post)
    assert llm.complete("s", "u") == "fallback answer"
    assert seen == [("gemini-3.5-flash-lite", 20), ("gemini-3.8-flash", 20)]


def test_service_rpc_handles_void_functions(monkeypatch):
    from core import supabase

    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service")
    get_settings.cache_clear()
    class FakeClient:
        def post(self, url, **k):
            return httpx.Response(204, content=b"", request=httpx.Request("POST", url))

    monkeypatch.setattr(supabase, "_http", lambda: FakeClient())
    assert supabase.service_rpc("refund_reel_quota", {"p_user": "u1"}) is None


def test_storage_upload_retries_dropped_connection(monkeypatch):
    from core import supabase

    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service")
    get_settings.cache_clear()
    attempts = []

    class FlakyClient:
        def request(self, method, url, **k):
            attempts.append(method)
            if len(attempts) == 1:
                raise httpx.ReadError("[SSL: SSLV3_ALERT_BAD_RECORD_MAC]", request=httpx.Request(method, url))
            return httpx.Response(200, json={"Key": "reels/u1/r1.mp4"}, request=httpx.Request(method, url))

    monkeypatch.setattr(supabase, "_http", lambda: FlakyClient())
    url = supabase.storage_upload("reels", "u1/r1.mp4", b"mp4", "video/mp4")
    assert url.endswith("/storage/v1/object/public/reels/u1/r1.mp4") and attempts == ["POST", "POST"]
