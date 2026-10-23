"""One Reel job end to end: script → voice → captions → render → upload. Called by the worker."""

import json
import logging
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path

from core.config import get_settings
from core.reels import ReelJobError
from core.reels.captions import build_ass
from core.reels.render import download_photos, pick_music, render_reel
from core.reels.script import generate_script, rupees
from core.reels.templates import TEMPLATES
from core.reels.voice import build_voiceover
from core.supabase import service_get, storage_download, storage_upload

log = logging.getLogger("trend2cart.reels")

MIN_SECONDS, MAX_SECONDS = 15.0, 30.0
TAIL = 0.8  # end card stays up a little after the last word
END_CARD = 3.0


def reel_length(voice_seconds: float) -> float:
    return round(min(max(voice_seconds + TAIL, MIN_SECONDS), MAX_SECONDS), 3)


def costs_paise(llm_usage: dict, tts_characters: int) -> dict:
    s = get_settings()
    llm = (llm_usage.get("prompt_tokens", 0) * s.llm_input_cost_paise_per_1m_tokens
           + llm_usage.get("completion_tokens", 0) * s.llm_output_cost_paise_per_1m_tokens) / 1_000_000
    tts = tts_characters * s.tts_cost_paise_per_10k_chars / 10_000
    return {"llm": round(llm), "tts": round(tts), "total": round(llm + tts)}


@contextmanager
def _timed(stats: dict, stage: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        stats["seconds"][stage] = round(time.perf_counter() - start, 2)


def run_reel_job(reel: dict, music: bool = True) -> dict:
    """Returns the fields to save on the reels row. Raises ReelJobError/LLMError/TTSError for sellers."""
    products = service_get("products", {"id": f"eq.{reel['product_id']}", "select": "*"})
    if not products or products[0]["selling_price_paise"] is None:
        raise ReelJobError("This product isn't available any more. Please pick another one.")
    product = products[0]
    template = TEMPLATES[reel.get("template_id") or 1]
    language = reel["language"]
    stats: dict = {"seconds": {}}
    llm_usage: dict = {}
    started = time.perf_counter()

    with tempfile.TemporaryDirectory(prefix="reel-") as tmp:
        workdir = Path(tmp)
        with _timed(stats, "script"):
            script = generate_script(product, reel.get("audience") or "online shoppers in Kerala", language, llm_usage,
                                     hook_idea=(reel.get("script") or {}).get("requested_hook"))
        with _timed(stats, "voice"):
            voice = build_voiceover(script.sentences, language, workdir)
        duration = reel_length(voice.duration)
        cta_start = voice.timings[-1][0]
        end_card_start = round(min(cta_start, duration - END_CARD), 3)
        price = rupees(product["selling_price_paise"])
        with _timed(stats, "photos"):
            # The seller's own photos win; otherwise the product's market photos.
            if reel.get("photo_paths"):
                photos = download_photos(reel["photo_paths"], fetch=lambda p: storage_download("seller-photos", p))
            else:
                photos = download_photos(product.get("image_urls") or [])
        with _timed(stats, "captions"):
            ass_file = workdir / "captions.ass"
            ass_file.write_text(build_ass(
                template=template, language=language, sentences=script.sentences, timings=voice.timings,
                duration=duration, end_card_start=end_card_start, price_text=price, cta=script.cta,
                product_name=None if photos else product["name"],
            ), encoding="utf-8")
        with _timed(stats, "render"):
            video = workdir / "reel.mp4"
            render_reel(template=template, photos=photos, voice=voice.path, ass_file=ass_file, duration=duration,
                        end_card_start=end_card_start, out=video, music=pick_music() if music else None)
        with _timed(stats, "upload"):
            video_url = storage_upload("reels", f"{reel['user_id']}/{reel['id']}.mp4", video.read_bytes(), "video/mp4")

    stats["seconds"]["total"] = round(time.perf_counter() - started, 2)
    stats.update(
        cost_paise=costs_paise(llm_usage, voice.characters),
        llm=llm_usage, tts_characters=voice.characters, video_seconds=duration,
        voice_tempo=voice.tempo, photos=len(photos), seller_photos=bool(reel.get("photo_paths")),
        template_id=template.id,
    )
    log.info("reel %s done %s", reel["id"], json.dumps(stats, ensure_ascii=False))
    return {
        "status": "done",
        "video_url": video_url,
        "caption": script.caption,
        "hashtags": script.hashtags,
        "script": script.model_dump(),
        "stats": stats,
        "error": None,
    }
