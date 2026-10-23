"""Dev tool: render sample Reels locally with the real pipeline stages (no database, no upload).

Run inside the Docker image (needs FFmpeg with libass), from the repo root:
  docker run --rm --env-file api/.env -v "$PWD/worker/experiments:/app/worker/experiments" t2c-api \
    python /app/worker/experiments/render_sample.py --language ml --templates 1 2 3

Uses real Gemini (script) and Sarvam (voice) calls. --photos uses local image files; with none,
the Reel shows the product name as a title card. --test-photos draws plain coloured test cards
(layout testing only, never shipped).
"""

import argparse
import json
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw

from core.reels.captions import build_ass
from core.reels.pipeline import END_CARD, costs_paise, reel_length
from core.reels.render import render_reel
from core.reels.script import generate_script, rupees
from core.reels.templates import TEMPLATES
from core.reels.voice import build_voiceover

OUT = Path(__file__).resolve().parent / "out"
PRODUCT = {"name": "Rechargeable Lint Remover", "category": "home_gadgets", "selling_price_paise": 45900}


def test_cards(workdir: Path, box: tuple[int, int]) -> list[Path]:
    paths = []
    for i, colour in enumerate(["#3B82F6", "#10B981"]):
        img = Image.new("RGB", (round(box[0] * 1.25), round(box[1] * 1.25)), colour)
        d = ImageDraw.Draw(img)
        d.ellipse((img.width * 0.25, img.height * 0.3, img.width * 0.75, img.height * 0.6), fill="#FFFFFF")
        path = workdir / f"card_{i}.jpg"
        img.save(path)
        paths.append(path)
    return paths


def tone(workdir: Path) -> Path:
    """A soft two-note loop standing in for a music track, to test ducking."""
    path = workdir / "tone.mp3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                    "aevalsrc='0.3*sin(2*PI*220*t)+0.2*sin(2*PI*330*t)':d=8:s=44100", str(path)], check=True)
    return path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--language", default="ml", choices=["ml", "hi", "en"])
    ap.add_argument("--audience", default="college girls in Kochi")
    ap.add_argument("--templates", type=int, nargs="+", default=[1, 2, 3])
    ap.add_argument("--photos", type=Path, nargs="*", default=[])
    ap.add_argument("--test-photos", action="store_true")
    ap.add_argument("--music", action="store_true", help="mix a test tone to check ducking")
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        timings: dict = {}
        usage: dict = {}
        t0 = time.perf_counter()
        script = generate_script(PRODUCT, args.audience, args.language, usage)
        timings["script"] = round(time.perf_counter() - t0, 2)
        print(json.dumps(script.model_dump(), ensure_ascii=False, indent=1))

        t0 = time.perf_counter()
        voice = build_voiceover(script.sentences, args.language, workdir)
        timings["voice"] = round(time.perf_counter() - t0, 2)
        duration = reel_length(voice.duration)
        end_card_start = round(min(voice.timings[-1][0], duration - END_CARD), 3)
        print(f"voice {voice.duration}s tempo {voice.tempo} → reel {duration}s, end card at {end_card_start}s")

        for tid in args.templates:
            template = TEMPLATES[tid]
            photos = [Path(p) for p in args.photos] or (test_cards(workdir, template.image_box[2:]) if args.test_photos else [])
            ass_file = workdir / f"captions_{tid}.ass"
            ass_file.write_text(build_ass(
                template=template, language=args.language, sentences=script.sentences, timings=voice.timings,
                duration=duration, end_card_start=end_card_start, price_text=rupees(PRODUCT["selling_price_paise"]),
                cta=script.cta, product_name=None if photos else PRODUCT["name"],
            ), encoding="utf-8")
            out = OUT / f"reel_{args.language}_t{tid}.mp4"
            t0 = time.perf_counter()
            render_reel(template=template, photos=photos, voice=voice.path, ass_file=ass_file, duration=duration,
                        end_card_start=end_card_start, out=workdir / out.name,
                        music=tone(workdir) if args.music else None)
            timings[f"render_t{tid}"] = round(time.perf_counter() - t0, 2)
            shutil.copy(workdir / out.name, out)
            # Frames for checking: a caption line, the price badge, the end card.
            price_t = voice.timings[-2][0] + 0.5
            for label, t in [("hook", voice.timings[0][0] + 0.5), ("price", price_t), ("end", duration - 1)]:
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(t), "-i", str(out),
                                "-frames:v", "1", "-vf", "scale=540:-1", str(OUT / f"{out.stem}_{label}.png")], check=True)
            print(f"✓ {out.name}")

    print("timings", timings, "cost_paise", costs_paise(usage, voice.characters), "llm", usage)


if __name__ == "__main__":
    main()
