"""Worker job-handling tests (no network): run from worker/ with `uv run --with pytest pytest -q`."""

import main
from core.llm import LLMError


def setup(monkeypatch, job):
    calls = []
    monkeypatch.setattr(main, "run_reel_job", job)
    monkeypatch.setattr(main, "service_update", lambda table, rid, fields: calls.append(("update", fields)))
    monkeypatch.setattr(main, "service_rpc", lambda fn, args=None: calls.append(("rpc", fn)))
    return calls


REEL = {"id": "r1", "user_id": "u1", "language": "ml", "template_id": 1}


def test_success_saves_result(monkeypatch):
    calls = setup(monkeypatch, lambda reel: {"status": "done", "video_url": "https://x/r1.mp4"})
    main.process(REEL)
    assert calls == [("update", {"status": "done", "video_url": "https://x/r1.mp4"})]


def test_seller_error_refunds_before_marking_failed(monkeypatch):
    def job(reel):
        raise LLMError("Our writing assistant is busy right now. Please try again in a minute.")

    calls = setup(monkeypatch, job)
    main.process(REEL)
    assert calls[0] == ("rpc", "refund_reel_quota")
    assert calls[1] == ("update", {"status": "failed", "error": "Our writing assistant is busy right now. "
                                   "Please try again in a minute. It didn't count against your limit."})


def test_crash_shows_generic_message(monkeypatch):
    def job(reel):
        raise KeyError("boom")

    calls = setup(monkeypatch, job)
    main.process(REEL)
    assert calls[1] == ("update", {"status": "failed", "error": main.GENERIC_ERROR})


def test_recovery_only_touches_old_processing_rows(monkeypatch):
    seen = {}
    monkeypatch.setattr(main, "service_get", lambda table, params: seen.update(params) or [])
    main.recover_interrupted()
    assert seen["status"] == "eq.processing" and seen["created_at"].startswith("lt.")
