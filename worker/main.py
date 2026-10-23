"""Reel worker: polls Supabase for queued Reels and renders them one at a time.

Run from worker/:  uv run python main.py
On Render's free plan it runs inside the API container (see start.sh).
"""

import logging
import time
from datetime import datetime, timedelta, timezone

from core.llm import LLMError
from core.reels import ReelJobError
from core.reels.pipeline import run_reel_job
from core.supabase import service_get, service_rpc, service_update
from core.tts import TTSError

POLL_SECONDS = 2
STUCK_AFTER = timedelta(minutes=10)  # jobs take under a minute; older 'processing' rows were interrupted
GENERIC_ERROR = "Something went wrong while making your Reel. Please try again. It didn't count against your limit."
INTERRUPTED = "This Reel was interrupted. Please try again. It didn't count against your limit."

log = logging.getLogger("trend2cart.worker")


def fail(reel: dict, message: str) -> None:
    # Refund first, so by the time the seller sees "didn't count against your limit" it's already true.
    service_rpc("refund_reel_quota", {"p_user": reel["user_id"]})
    service_update("reels", reel["id"], {"status": "failed", "error": message})


def recover_interrupted() -> None:
    """A restart mid-job leaves rows stuck in 'processing'; fail them so sellers can retry.
    Only old ones: another worker (e.g. a teammate's local one) may be rendering recent rows right now."""
    cutoff = (datetime.now(timezone.utc) - STUCK_AFTER).isoformat()
    for reel in service_get("reels", {"status": "eq.processing", "created_at": f"lt.{cutoff}", "select": "id,user_id"}):
        log.warning("reel %s was interrupted by a restart", reel["id"])
        fail(reel, INTERRUPTED)


def process(reel: dict) -> None:
    log.info("reel %s started (language=%s, template=%s)", reel["id"], reel["language"], reel.get("template_id"))
    try:
        service_update("reels", reel["id"], run_reel_job(reel))
    except (ReelJobError, LLMError, TTSError) as e:
        log.warning("reel %s failed: %s", reel["id"], e)
        fail(reel, f"{e} It didn't count against your limit.")
    except Exception:
        log.exception("reel %s crashed", reel["id"])
        fail(reel, GENERIC_ERROR)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    recover_interrupted()
    log.info("worker ready, polling every %ss", POLL_SECONDS)
    while True:
        try:
            claimed = service_rpc("claim_next_reel")
        except Exception:
            log.exception("couldn't poll for Reels; retrying in 10s")
            time.sleep(10)
            continue
        if not claimed:
            time.sleep(POLL_SECONDS)
            continue
        try:
            process(claimed[0])
        except Exception:
            # Even saving the failure failed (e.g. network). Keep the loop alive; the row stays
            # 'processing' and recover_interrupted() fails + refunds it on the next restart.
            log.exception("reel %s: couldn't record the result", claimed[0]["id"])


if __name__ == "__main__":
    main()
