"""Voiceover: TTS each sentence, measure with ffprobe, concatenate with short pauses."""

import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from core.config import get_settings
from core.reels import ReelJobError
from core.tts import synthesize

LEAD_IN = 0.3  # seconds of silence before the hook
GAP = 0.25  # pause between sentences
MAX_VOICE = 28.0  # leaves room for a short tail inside a 30 s Reel
MAX_TEMPO = 1.3  # faster than this sounds rushed


@dataclass(frozen=True)
class Voiceover:
    path: Path
    timings: list[tuple[float, float]]  # (start, end) seconds per sentence, after any speed-up
    duration: float
    tempo: float
    characters: int


def media_duration(path: Path) -> float:
    out = subprocess.run(
        [get_settings().ffprobe_path, "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(json.loads(out.stdout)["format"]["duration"])


def plan_timings(durations: list[float]) -> tuple[list[tuple[float, float]], float, float]:
    """Pure: sentence clip lengths -> (timings, total duration, tempo). Speeds up only if too long."""
    raw_total = LEAD_IN + sum(durations) + GAP * (len(durations) - 1)
    tempo = 1.0 if raw_total <= MAX_VOICE else raw_total / MAX_VOICE
    if tempo > MAX_TEMPO:
        raise ReelJobError("The script came out too long for a 30-second Reel. Please try again.")
    timings, t = [], LEAD_IN
    for d in durations:
        timings.append((round(t / tempo, 3), round((t + d) / tempo, 3)))
        t += d + GAP
    return timings, round(raw_total / tempo, 3), round(tempo, 4)


def build_voiceover(sentences: list[str], language: str, workdir: Path) -> Voiceover:
    # Sentences are independent, so synthesize in parallel (most of the voice time is network wait).
    with ThreadPoolExecutor(max_workers=4) as pool:
        clips = list(pool.map(lambda s: synthesize(s, language), sentences))
    paths = []
    for i, audio in enumerate(clips):
        path = workdir / f"line_{i}.mp3"
        path.write_bytes(audio)
        paths.append(path)
    durations = [media_duration(p) for p in paths]
    timings, total, tempo = plan_timings(durations)

    # [silence][line0][gap][line1]...[lineN] → one mono 44.1 kHz track, then speed-up if needed.
    inputs, parts = [], [f"aevalsrc=0:d={LEAD_IN}:s=44100[lead]"]
    labels = ["[lead]"]
    for i, p in enumerate(paths):
        inputs += ["-i", str(p)]
        parts.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=mono[l{i}]")
        labels.append(f"[l{i}]")
        if i < len(paths) - 1:
            parts.append(f"aevalsrc=0:d={GAP}:s=44100[g{i}]")
            labels.append(f"[g{i}]")
    chain = "".join(labels) + f"concat=n={len(labels)}:v=0:a=1"
    chain += f",atempo={tempo}[out]" if tempo != 1.0 else "[out]"
    out = workdir / "voice.wav"
    result = subprocess.run(
        [get_settings().ffmpeg_path, "-y", "-hide_banner", "-loglevel", "error", *inputs,
         "-filter_complex", ";".join(parts + [chain]), "-map", "[out]", "-ac", "1", str(out)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"voice concat failed: {result.stderr[-500:]}")
    return Voiceover(path=out, timings=timings, duration=total, tempo=tempo,
                     characters=sum(len(s) for s in sentences))
