"""Throwaway experiment: vernacular TTS + Malayalam caption rendering. Not used by the app.

Run from worker/:
  uv run --group experiments python experiments/lang_test.py [--image path/to/product.jpg]

Optional keys (in worker/.env or the shell):
  GOOGLE_TTS_API_KEY  Google Cloud API key with Text-to-Speech API enabled
  SARVAM_API_KEY      Sarvam AI API subscription key

Outputs go to worker/experiments/out/ (git-ignored).
"""

import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import httpx

WORKER = Path(__file__).resolve().parents[1]
OUT_REL = Path("experiments/out")  # relative to WORKER: FFmpeg filter args break on the space in the project path
OUT = WORKER / OUT_REL
FONTS_REL = Path("assets/fonts")
FONT_REGULAR = WORKER / FONTS_REL / "NotoSansMalayalam-Regular.ttf"
FONT_BOLD = WORKER / FONTS_REL / "NotoSansMalayalam-Bold.ttf"

# Chosen to exercise hard Malayalam shaping: ന്റ (nta), സ്വെ (sva + left vowel sign),
# റ്റ (tta), ത്ത, ന്ന, ക്യാ (ya-sign), ഭ്യ, and chillus ർ ൾ ൺ.
LINES = {
    "ml": [
        "ഈ ലിന്റ് റിമൂവർ നിങ്ങളുടെ പഴയ സ്വെറ്ററുകൾ പുത്തനാക്കും.",
        "ഇന്ന് തന്നെ ഓർഡർ ചെയ്യൂ, ക്യാഷ് ഓൺ ഡെലിവറി ലഭ്യമാണ്.",
    ],
    "hi": [
        "यह लिंट रिमूवर आपके पुराने स्वेटर को नया जैसा बना देगा।",
        "आज ही ऑर्डर करें, कैश ऑन डिलीवरी उपलब्ध है।",
    ],
    "en": [
        "This lint remover makes your old sweaters look brand new.",
        "Order today, cash on delivery available.",
    ],
}
LANG_CODES = {"ml": "ml-IN", "hi": "hi-IN", "en": "en-IN"}


def header(title: str) -> None:
    print(f"\n=== {title} ===")


def load_env() -> None:
    """Read worker/.env without overriding the shell (keeps this script dependency-free)."""
    env = WORKER / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


# ---------- 3. FFmpeg capabilities ----------

def ffmpeg_report() -> dict:
    header("FFmpeg")
    if not shutil.which("ffmpeg"):
        print("✗ ffmpeg not found on PATH")
        return {"ffmpeg": False, "ass": False}
    version = subprocess.run(["ffmpeg", "-hide_banner", "-version"], capture_output=True, text=True).stdout
    print(version.splitlines()[0])
    buildconf = subprocess.run(["ffmpeg", "-hide_banner", "-buildconf"], capture_output=True, text=True)
    flags = buildconf.stdout + buildconf.stderr
    filters = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    caps = {
        "libass": "--enable-libass" in flags,
        "libharfbuzz": "--enable-libharfbuzz" in flags,
        "libfreetype": "--enable-libfreetype" in flags,
        "libfontconfig": "--enable-libfontconfig" in flags,
        "libmp3lame": "--enable-libmp3lame" in flags,
        "ass filter": bool(re.search(r"^\s*\S+\s+ass\s", filters, re.M)),
    }
    for name, ok in caps.items():
        print(f"{'✓' if ok else '✗'} {name}")
    if not caps["ass filter"]:
        print("→ This FFmpeg can't burn in subtitles. Fix (macOS):\n"
              "    brew uninstall ffmpeg\n"
              "    brew tap homebrew-ffmpeg/ffmpeg\n"
              "    brew install homebrew-ffmpeg/ffmpeg/ffmpeg\n"
              "  Linux/Docker (Render/Railway): apt-get install -y ffmpeg  (Debian/Ubuntu builds include libass)")
    return {"ffmpeg": True, "ass": caps["ass filter"]}


def duration_seconds(path: Path) -> float | None:
    if not shutil.which("ffprobe"):
        return None
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(json.loads(out.stdout)["format"]["duration"])
    except (KeyError, ValueError, json.JSONDecodeError):
        return None


# ---------- 1. TTS ----------

def google_tts(lang: str, text: str, key: str) -> bytes:
    resp = httpx.post(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        params={"key": key},
        json={
            "input": {"text": text},
            "voice": {"languageCode": LANG_CODES[lang]},  # Google picks its default voice for the language
            "audioConfig": {"audioEncoding": "MP3"},
        },
        timeout=60,
    )
    if resp.is_error:
        raise RuntimeError(f"{resp.status_code}: {resp.text[:300]}")
    return base64.b64decode(resp.json()["audioContent"])


def sarvam_tts(lang: str, text: str, key: str) -> bytes:
    resp = httpx.post(
        "https://api.sarvam.ai/text-to-speech",
        headers={"api-subscription-key": key},
        json={
            "text": text,
            "language_code": LANG_CODES[lang],
            "model": "bulbul:v3",
            "output_audio_codec": "mp3",
        },
        timeout=60,
    )
    if resp.is_error:
        raise RuntimeError(f"{resp.status_code}: {resp.text[:300]}")
    return base64.b64decode(resp.json()["audios"][0])


def run_tts() -> Path | None:
    """Returns the Malayalam MP3 to use as the test video's audio, if any provider produced one."""
    header("TTS")
    providers = [
        ("google", os.environ.get("GOOGLE_TTS_API_KEY"), google_tts),
        ("sarvam", os.environ.get("SARVAM_API_KEY"), sarvam_tts),
    ]
    malayalam_audio = None
    for name, key, synth in providers:
        if not key:
            print(f"– {name}: skipped (no {'GOOGLE_TTS_API_KEY' if name == 'google' else 'SARVAM_API_KEY'})")
            continue
        for lang, lines in LINES.items():
            path = OUT / f"{name}_{lang}.mp3"
            try:
                path.write_bytes(synth(lang, " ".join(lines), key))
            except (RuntimeError, httpx.HTTPError, KeyError) as e:
                print(f"✗ {name} {lang}: {e}")
                continue
            secs = duration_seconds(path)
            print(f"✓ {name} {lang}: {path.relative_to(WORKER)}  {secs:.2f}s" if secs else f"✓ {name} {lang}: {path}")
            if lang == "ml" and malayalam_audio is None:
                malayalam_audio = path
    return malayalam_audio


# ---------- 2. Rendering ----------

def make_test_image() -> Path:
    """Stand-in product picture for this experiment only (pass --image for a real one)."""
    from PIL import Image, ImageDraw

    path = OUT / "test_product.png"
    img = Image.new("RGB", (800, 800), "#ffffff")
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((150, 150, 650, 650), radius=60, fill="#2f6fde")
    draw.ellipse((300, 300, 500, 500), fill="#ffffff")
    img.save(path)
    return path


def write_ass(path: Path) -> None:
    ml1, ml2 = LINES["ml"]
    path.write_text(
        f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Noto Sans Malayalam,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,0,2,80,80,380,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:02.50,Caption,,0,0,0,,{ml1}
Dialogue: 0,0:00:02.50,0:00:05.00,Caption,,0,0,0,,{ml2}
""",
        encoding="utf-8",
    )


def render_video(image: Path, audio: Path | None) -> None:
    header("FFmpeg render (1080x1920, 5 s, Malayalam ASS captions)")
    ass = OUT_REL / "captions.ass"
    write_ass(WORKER / ass)
    video = OUT_REL / "test_ml.mp4"
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "color=c=0xF4E9D8:s=1080x1920:r=30:d=5",
        "-loop", "1", "-t", "5", "-i", str(image),
    ]
    if audio:
        cmd += ["-i", str(audio)]
    cmd += [
        "-filter_complex",
        f"[1:v]scale=860:-2[product];[0:v][product]overlay=(W-w)/2:300,"
        f"ass={ass.as_posix()}:fontsdir={FONTS_REL.as_posix()}[v]",
        "-map", "[v]",
    ]
    if audio:
        cmd += ["-map", "2:a", "-c:a", "aac", "-b:a", "128k"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", "5", "-movflags", "+faststart", str(video)]
    result = subprocess.run(cmd, cwd=WORKER, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"✗ render failed:\n{result.stderr.strip()}")
        return
    frame = OUT_REL / "test_ml_frame.png"
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", "1", "-i", str(video), "-frames:v", "1", str(frame)],
        cwd=WORKER,
    )
    print(f"✓ {video}  ({duration_seconds(WORKER / video) or 0:.2f}s)")
    print(f"✓ {frame}  (still frame at 1 s, easier to zoom)")


def render_pillow() -> None:
    header("Pillow")
    from PIL import Image, ImageDraw, ImageFont, features

    raqm = features.check("raqm")
    print(f"{'✓' if raqm else '✗'} libraqm available (needed for correct Malayalam shaping in Pillow)")
    if not raqm:
        print("→ Pillow's wheels bundle raqm but load FriBiDi at runtime. Fix:\n"
              "    macOS:  brew install fribidi\n"
              "            export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib   (then re-run)\n"
              "    Linux/Docker: apt-get install -y libfribidi0")

    # Each sentence split in half at a word boundary so all test conjuncts fit in 1080 px.
    rows = []
    for sentence in LINES["ml"]:
        words = sentence.split()
        rows += [" ".join(words[: len(words) // 2]), " ".join(words[len(words) // 2:])]
    layouts = [("basic", ImageFont.Layout.BASIC)]  # deliberately unshaped, to show what "broken" looks like
    if raqm:
        layouts.insert(0, ("raqm", ImageFont.Layout.RAQM))
    for name, layout in layouts:
        font = ImageFont.truetype(str(FONT_BOLD), 56, layout_engine=layout)
        img = Image.new("RGB", (1080, 60 + 100 * len(rows)), "#F4E9D8")
        draw = ImageDraw.Draw(img)
        for i, row in enumerate(rows):
            draw.text((40, 30 + 100 * i), row, font=font, fill="#111111")
        path = OUT / f"pillow_{name}.png"
        img.save(path)
        label = "correct shaping expected" if name == "raqm" else "NO shaping: shows what broken looks like"
        print(f"✓ {path.relative_to(WORKER)}  ({label})")


def write_reference_html() -> None:
    """Browsers shape Malayalam correctly; use this page as the visual reference."""
    path = OUT / "reference.html"
    lines = "".join(f"<p>{line}</p>" for line in LINES["ml"])
    path.write_text(
        f"""<!doctype html><meta charset="utf-8"><title>Malayalam reference</title>
<style>
@font-face {{ font-family: Ref; src: url("../../assets/fonts/NotoSansMalayalam-Bold.ttf"); }}
body {{ font-family: Ref, sans-serif; font-size: 48px; background: #F4E9D8; padding: 24px; }}
</style>{lines}""",
        encoding="utf-8",
    )
    print(f"✓ {path.relative_to(WORKER)}  (open in a browser: correct reference rendering)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--image", type=Path, help="product image to use (default: a generated test shape)")
    args = parser.parse_args()

    load_env()
    OUT.mkdir(parents=True, exist_ok=True)
    if not FONT_BOLD.exists():
        sys.exit(f"Missing font: {FONT_BOLD}")

    caps = ffmpeg_report()
    audio = run_tts()
    image = args.image.resolve() if args.image else make_test_image()
    if caps["ass"]:
        render_video(image, audio)
    else:
        header("FFmpeg render")
        print("– skipped: this FFmpeg has no libass (see fix above)")
    render_pillow()
    write_reference_html()
    print(f"\nOpen the folder: open {OUT_REL}")


if __name__ == "__main__":
    main()
