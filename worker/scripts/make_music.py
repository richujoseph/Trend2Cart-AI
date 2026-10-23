"""Generate the original background-music loops in worker/assets/music (no licensing questions: we made them).

Run from worker/:  uv run --with numpy python scripts/make_music.py
Each loop is ~32 s of soft chords + bass + light drums, mixed quietly; the renderer plays it at low volume
and ducks it under the voice.
"""

import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parents[1] / "assets" / "music"
NOTES = {"A": 0, "B": 2, "C": 3, "D": 5, "E": 7, "F": 8, "G": 10}


def freq(note: str) -> float:
    """"A3" → 220 Hz; supports sharps like "C#4"."""
    name, octave = note[:-1], int(note[-1])
    # Octave numbers change at C, so C–G of octave 4 sit *below* A4.
    semis = NOTES[name[0]] + (1 if "#" in name else 0) + 12 * (octave - 4) - (12 if name[0] in "CDEFG" else 0)
    return 440.0 * 2 ** (semis / 12)


def env(n: int, attack: float, release: float) -> np.ndarray:
    a, r = max(1, int(attack * SR)), max(1, int(release * SR))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def tone(f: float, seconds: float, kind: str, attack=0.01, release=0.2) -> np.ndarray:
    t = np.arange(int(seconds * SR)) / SR
    if kind == "pad":  # soft detuned sines
        w = sum(np.sin(2 * np.pi * f * d * t) for d in (0.995, 1.0, 1.005)) / 3
    elif kind == "pluck":  # bright, quickly decaying
        w = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 5)
    elif kind == "marimba":
        w = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 4 * t)) * np.exp(-t * 7)
    else:  # bass
        w = np.sin(2 * np.pi * f * t) + 0.2 * np.sin(4 * np.pi * f * t)
    return w * env(len(t), attack, release)


def kick(seconds=0.35) -> np.ndarray:
    t = np.arange(int(seconds * SR)) / SR
    return np.sin(2 * np.pi * (50 + 90 * np.exp(-t * 30)) * t) * np.exp(-t * 9)


def hat(seconds=0.06, rng=np.random.default_rng(7)) -> np.ndarray:
    n = int(seconds * SR)
    noise = rng.uniform(-1, 1, n)
    return np.diff(noise, prepend=0) * np.exp(-np.arange(n) / SR * 60) * 0.5  # crude high-pass


def place(track: np.ndarray, sound: np.ndarray, at: float, gain: float) -> None:
    i = int(at * SR)
    j = min(len(track), i + len(sound))
    track[i:j] += sound[: j - i] * gain


def song(bpm: int, chords: list[list[str]], bass: list[str], lead: str, bars: int, hats: int) -> np.ndarray:
    beat = 60 / bpm
    bar = 4 * beat
    track = np.zeros(int(bars * bar * SR) + SR)
    for b in range(bars):
        start = b * bar
        chord, root = chords[b % len(chords)], bass[b % len(bass)]
        for n in chord:  # sustained chord
            place(track, tone(freq(n), bar, "pad", attack=0.3, release=0.5), start, 0.10)
        if lead in ("pluck", "marimba"):  # arpeggio on 8th notes
            for k in range(8):
                place(track, tone(freq(chord[k % len(chord)]), beat * 0.9, lead, release=0.1), start + k * beat / 2, 0.12)
        place(track, tone(freq(root), bar * 0.95, "bass", attack=0.02, release=0.3), start, 0.18)
        for k in (0, 2):
            place(track, kick(), start + k * beat, 0.45)
        for k in range(hats):
            place(track, hat(), start + k * bar / hats, 0.10 if k % 2 else 0.06)
    track = track[: int(bars * bar * SR)]
    fade = int(0.05 * SR)  # tiny fades so the loop point doesn't click
    track[:fade] *= np.linspace(0, 1, fade)
    track[-fade:] *= np.linspace(1, 0, fade)
    return track / max(1e-9, np.abs(track).max()) * 0.8


TRACKS = {
    "calm-lofi": dict(bpm=84, chords=[["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"], ["G3", "B3", "D4"]],
                      bass=["A2", "F2", "C2", "G2"], lead="pad", bars=12, hats=8),
    "bright-pop": dict(bpm=112, chords=[["C4", "E4", "G4"], ["G3", "B3", "D4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"]],
                       bass=["C2", "G2", "A2", "F2"], lead="pluck", bars=16, hats=8),
    "warm-marimba": dict(bpm=96, chords=[["D4", "F#4", "A4"], ["B3", "D4", "F#4"], ["G3", "B3", "D4"], ["A3", "C#4", "E4"]],
                         bass=["D2", "B2", "G2", "A2"], lead="marimba", bars=12, hats=4),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in TRACKS.items():
        audio = song(**spec)
        wav = OUT / f"{name}.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((audio * 32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "96k", str(OUT / f"{name}.mp3")], check=True)
        wav.unlink()
        print(f"✓ {name}.mp3  {len(audio) / SR:.1f}s")


if __name__ == "__main__":
    main()
