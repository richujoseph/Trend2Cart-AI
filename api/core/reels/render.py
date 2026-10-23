"""FFmpeg render: product photos with slow zoom/pan and cross-fades, template overlays, ASS text, audio mix."""

import io
import random
import subprocess
from functools import lru_cache
from pathlib import Path

import httpx
from PIL import Image, ImageOps

from core.config import get_settings
from core.reels.templates import Template

W, H, FPS = 1080, 1920, 30
XFADE = 0.6  # cross-fade seconds between photos
MAX_PHOTOS = 4
MAX_PHOTO_BYTES = 10 * 1024 * 1024
MUSIC_VOLUME = 0.18  # under the voice; the sidechain compressor ducks it further while speaking


def assets_dir() -> Path:
    configured = get_settings().reel_assets_dir
    return Path(configured) if configured else Path(__file__).resolve().parents[3] / "worker" / "assets"


@lru_cache
def ffmpeg_has_libass() -> bool:
    out = subprocess.run([get_settings().ffmpeg_path, "-hide_banner", "-filters"], capture_output=True, text=True)
    return any(line.split()[1:2] == ["ass"] for line in out.stdout.splitlines())


def download_photos(urls: list[str], workdir: Path, box: tuple[int, int]) -> list[Path]:
    """Fetch up to MAX_PHOTOS product photos, cover-crop to the template's photo box. Skips broken ones."""
    # 1.25x the box so the zoom/pan has pixels to move into without upscaling blur.
    target = (round(box[0] * 1.25 / 2) * 2, round(box[1] * 1.25 / 2) * 2)
    photos = []
    for i, url in enumerate(urls[:MAX_PHOTOS]):
        if not url.startswith("https://"):
            continue
        try:
            resp = httpx.get(url, timeout=15, follow_redirects=True)
            if resp.is_error or len(resp.content) > MAX_PHOTO_BYTES:
                continue
            img = ImageOps.exif_transpose(Image.open(io.BytesIO(resp.content))).convert("RGB")
        except (httpx.HTTPError, OSError):
            continue
        path = workdir / f"photo_{i}.jpg"
        ImageOps.fit(img, target, Image.LANCZOS).save(path, quality=92)
        photos.append(path)
    return photos


def _photo_segments(photos: list[Path], box: tuple[int, int, int, int], duration: float) -> tuple[list[str], list[str], str]:
    """Inputs + filter lines turning N photos into one zoom/pan stream of `duration` seconds, labelled [photos]."""
    _, _, bw, bh = box
    n = len(photos)
    seg = (duration + (n - 1) * XFADE) / n
    frames = round(seg * FPS) + 1
    inputs, lines = [], []
    for i, p in enumerate(photos):
        inputs += ["-i", str(p)]
        if i % 2 == 0:  # slow push-in to the centre
            motion = (f"z='min(1+0.10*on/{frames},1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'")
        else:  # gentle pan left → right at a fixed zoom
            motion = f"z=1.10:x='(iw-iw/zoom)*on/{frames}':y='ih/2-(ih/zoom/2)'"
        lines.append(f"[{i}:v]zoompan={motion}:d={frames}:s={bw}x{bh}:fps={FPS},setsar=1,format=yuv420p[p{i}]")
    if n == 1:
        lines.append(f"[p0]trim=duration={duration}[photos]")
        return inputs, lines, "[photos]"
    prev = "[p0]"
    for i in range(1, n):
        out = "[photos]" if i == n - 1 else f"[x{i}]"
        lines.append(f"{prev}[p{i}]xfade=transition=fade:duration={XFADE}:offset={round(i * (seg - XFADE), 3)}{out}")
        prev = out
    return inputs, lines, "[photos]"


def _hex(colour: str, opacity: float = 1.0) -> str:
    return f"0x{colour[1:]}@{opacity}"


def render_reel(
    *,
    template: Template,
    photos: list[Path],
    voice: Path,
    ass_file: Path,
    duration: float,
    end_card_start: float,
    out: Path,
    music: Path | None = None,
) -> None:
    if not ffmpeg_has_libass():
        raise RuntimeError("This FFmpeg build has no libass, so captions can't be burned in. See README → FFmpeg.")
    fonts = assets_dir() / "fonts"
    t = template
    x, y, bw, bh = t.image_box

    inputs, lines = [], []
    if photos:
        inputs, lines, photo_label = _photo_segments(photos, t.image_box, duration)
    lines.append(f"color=c={_hex(t.background)}:s={W}x{H}:r={FPS}:d={duration}[bg]")
    video = "[bg]"
    if photos:
        lines.append(f"{video}{photo_label}overlay={x}:{y}:shortest=1[v0]")
        video = "[v0]"
    chain = []
    if t.panel:
        px, py, pw, ph, colour, opacity = t.panel
        chain.append(f"drawbox=x={px}:y={py}:w={pw}:h={ph}:color={_hex(colour, opacity)}:t=fill")
    chain.append(f"drawbox=x=0:y=0:w={W}:h={H}:color={_hex(t.end_bg)}:t=fill:enable='gte(t,{end_card_start})'")
    # The .ass file is passed relative to cwd; fontsdir is single-quoted so spaces in the path are safe.
    chain.append(f"ass={ass_file.name}:fontsdir='{fonts.as_posix()}'")
    chain.append("format=yuv420p")
    lines.append(f"{video}{','.join(chain)}[vout]")

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
    result = subprocess.run(cmd, cwd=ass_file.parent, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg render failed: {result.stderr[-800:]}")


def pick_music() -> Path | None:
    tracks = sorted((assets_dir() / "music").glob("*.mp3"))
    return random.choice(tracks) if tracks else None
