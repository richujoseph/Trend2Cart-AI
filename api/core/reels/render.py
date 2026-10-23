"""Reel render: Pillow composes one polished scene per product photo; FFmpeg adds motion, cross-fades,
a progress bar, the end card, animated ASS text and the audio mix."""

import io
import random
import subprocess
from functools import lru_cache
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

from core.config import get_settings
from core.reels.templates import Template

W, H, FPS = 1080, 1920, 30
XFADE = 0.6  # cross-fade seconds between photos
MAX_PHOTOS = 4
MAX_PHOTO_BYTES = 10 * 1024 * 1024
MUSIC_VOLUME = 0.18  # under the voice; the sidechain compressor ducks it further while speaking
CARD_RADIUS = 36


def assets_dir() -> Path:
    configured = get_settings().reel_assets_dir
    return Path(configured) if configured else Path(__file__).resolve().parents[3] / "worker" / "assets"


@lru_cache
def ffmpeg_has_libass() -> bool:
    out = subprocess.run([get_settings().ffmpeg_path, "-hide_banner", "-filters"], capture_output=True, text=True)
    return any(line.split()[1:2] == ["ass"] for line in out.stdout.splitlines())


def load_photo(data: bytes) -> Image.Image | None:
    try:
        return ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    except OSError:
        return None


def download_photos(urls: list[str], fetch=None) -> list[Image.Image]:
    """Fetch up to MAX_PHOTOS product photos (https only), skipping broken ones.
    `fetch(url) -> bytes` lets callers read private storage; defaults to a plain GET."""
    photos = []
    for url in urls[:MAX_PHOTOS]:
        try:
            if fetch:
                data = fetch(url)
            else:
                if not url.startswith("https://"):
                    continue
                resp = httpx.get(url, timeout=15, follow_redirects=True)
                if resp.is_error:
                    continue
                data = resp.content
        except (httpx.HTTPError, RuntimeError):
            continue
        if len(data) <= MAX_PHOTO_BYTES and (img := load_photo(data)):
            photos.append(img)
    return photos


def _hex_rgb(colour: str) -> tuple[int, int, int]:
    return tuple(int(colour[i:i + 2], 16) for i in (1, 3, 5))


def compose_scene(photo: Image.Image | None, t: Template) -> Image.Image:
    """One 1080x1920 still: backdrop + (photo on a rounded card with shadow) + caption panel/fade."""
    canvas = Image.new("RGB", (W, H), t.background)
    if photo is None:
        # Title-card scene (no photos): vertical gradient from the template colour to near-black.
        top, bottom = _hex_rgb(t.background), (12, 12, 12)
        grad = Image.linear_gradient("L").resize((W, H))
        canvas = Image.composite(Image.new("RGB", (W, H), bottom), Image.new("RGB", (W, H), top), grad)
    elif t.backdrop in ("blur_dark", "blur_light"):
        # Blur at quarter size, then scale up: same look, ~16x less work.
        small = ImageOps.fit(photo, (W // 4, H // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(14))
        bg = small.resize((W, H), Image.BICUBIC)
        if t.backdrop == "blur_dark":
            bg = ImageEnhance.Brightness(bg).enhance(0.42)
        else:
            bg = Image.blend(bg, Image.new("RGB", (W, H), t.background), 0.55)
        canvas.paste(bg)

    if t.panel:
        px, py, pw, ph, colour = t.panel
        ImageDraw.Draw(canvas).rectangle((px, py, px + pw, py + ph), fill=colour)
    if t.bottom_fade:
        fade = Image.linear_gradient("L").resize((W, 820))  # transparent → dark, top to bottom
        canvas.paste(Image.new("RGB", (W, 820), (0, 0, 0)), (0, H - 820), fade.point(lambda v: int(v * 0.85)))

    if photo is not None:
        x, y, bw, bh = t.card_box
        b = t.card_border
        img = ImageOps.contain(photo, (bw - 2 * b, bh - 2 * b), Image.LANCZOS)
        if img.width > photo.width:  # upscaled small supplier photo: restore some edge crispness
            img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2))
        card = Image.new("RGB", (img.width + 2 * b, img.height + 2 * b), "white")
        card.paste(img, (b, b))
        mask = Image.new("L", card.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, card.width - 1, card.height - 1), CARD_RADIUS, fill=255)
        card = card.convert("RGBA")
        card.putalpha(mask)
        if t.card_tilt:
            card = card.rotate(t.card_tilt, resample=Image.BICUBIC, expand=True)
        cx, cy = x + (bw - card.width) // 2, y + (bh - card.height) // 2
        shadow = Image.new("RGBA", (card.width + 120, card.height + 120), (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 150), (60, 60), card.getchannel("A"))
        shadow = shadow.filter(ImageFilter.GaussianBlur(28))
        canvas.paste(shadow, (cx - 60, cy - 40), shadow)
        canvas.paste(card, (cx, cy), card)
    return canvas


def _scene_streams(scenes: list[Path], duration: float) -> tuple[list[str], list[str]]:
    """Inputs + filter lines turning N scenes into one moving stream of `duration` seconds, labelled [scenes]."""
    n = len(scenes)
    seg = (duration + (n - 1) * XFADE) / n
    frames = round(seg * FPS) + 1
    inputs, lines = [], []
    for i, p in enumerate(scenes):
        inputs += ["-i", str(p)]
        if i % 2 == 0:  # slow push-in
            motion = f"z='1+0.06*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        else:  # slow drift down at a fixed zoom
            motion = f"z=1.06:x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*on/{frames}'"
        lines.append(f"[{i}:v]zoompan={motion}:d={frames}:s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[s{i}]")
    if n == 1:
        lines.append(f"[s0]trim=duration={duration}[scenes]")
        return inputs, lines
    prev = "[s0]"
    for i in range(1, n):
        out = "[scenes]" if i == n - 1 else f"[x{i}]"
        lines.append(f"{prev}[s{i}]xfade=transition=fade:duration={XFADE}:offset={round(i * (seg - XFADE), 3)}{out}")
        prev = out
    return inputs, lines


def _hex(colour: str, opacity: float = 1.0) -> str:
    return f"0x{colour[1:]}@{opacity}"


def render_reel(
    *,
    template: Template,
    photos: list[Image.Image],
    voice: Path,
    ass_file: Path,
    duration: float,
    end_card_start: float,
    out: Path,
    music: Path | None = None,
) -> None:
    if not ffmpeg_has_libass():
        raise RuntimeError("This FFmpeg build has no libass, so captions can't be burned in. See README → FFmpeg.")
    workdir = ass_file.parent
    scenes = []
    for i, photo in enumerate(photos or [None]):
        path = workdir / f"scene_{i}.jpg"
        compose_scene(photo, template).save(path, quality=92)
        scenes.append(path)

    inputs, lines = _scene_streams(scenes, duration)
    t = template
    chain = [
        # Progress bar along the top edge, filling over the whole Reel.
        f"drawbox=x=0:y=0:w='iw*t/{duration}':h=10:color={_hex(t.accent)}:t=fill",
        f"drawbox=x=0:y=0:w={W}:h={H}:color={_hex(t.end_bg)}:t=fill:enable='gte(t,{end_card_start})'",
        # The .ass file is passed relative to cwd; fontsdir is single-quoted so spaces in the path are safe.
        f"ass={ass_file.name}:fontsdir='{(assets_dir() / 'fonts').as_posix()}'",
        "format=yuv420p",
    ]
    lines.append(f"[scenes]{','.join(chain)}[vout]")

    voice_idx = len(inputs) // 2
    inputs += ["-i", str(voice)]
    if music:
        music_idx = voice_idx + 1
        inputs += ["-stream_loop", "-1", "-i", str(music)]
        lines.append(f"[{voice_idx}:a]aresample=44100,apad=whole_dur={duration},asplit=2[voice][key]")
        lines.append(f"[{music_idx}:a]aresample=44100,volume={MUSIC_VOLUME}[bgm]")
        lines.append("[bgm][key]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[ducked]")
        lines.append("[voice][ducked]amix=inputs=2:duration=first:normalize=0[aout]")
    else:
        lines.append(f"[{voice_idx}:a]aresample=44100,apad=whole_dur={duration}[aout]")

    cmd = [
        get_settings().ffmpeg_path, "-y", "-hide_banner", "-loglevel", "error", *inputs,
        "-filter_complex", ";".join(lines), "-map", "[vout]", "-map", "[aout]",
        "-t", str(duration), "-r", str(FPS),
        # Cap threads: x264 sizes its thread pool from the host's CPU count, which on shared hosting can be
        # dozens of cores and exhaust a 512 MB instance.
        "-threads", "2", "-filter_threads", "2",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart", str(out),
    ]
    result = subprocess.run(cmd, cwd=workdir, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg render failed: {result.stderr[-800:]}")


def pick_music() -> Path | None:
    tracks = sorted((assets_dir() / "music").glob("*.mp3"))
    return random.choice(tracks) if tracks else None
