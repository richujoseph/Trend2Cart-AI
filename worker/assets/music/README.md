# Background music

The worker picks one `.mp3` here at random per Reel, plays it quietly and ducks it under the voice.

The included loops (`calm-lofi`, `bright-pop`, `warm-marimba`) are **original**: synthesised by
`worker/scripts/make_music.py`, so there are no licensing questions. Regenerate or tweak them with:

```bash
cd worker && uv run --no-project --with numpy python scripts/make_music.py
```

You can add other tracks only if their licence allows commercial use without attribution
(e.g. YouTube Audio Library "No attribution required", Pixabay Music). Keep the licence link for
each added track in this folder (e.g. `track-name.txt`).
