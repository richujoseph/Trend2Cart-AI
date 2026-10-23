"""Three Reel looks. Layout numbers are pixels on a 1080x1920 canvas.

Safe areas: Instagram covers ~200 px at the top, ~420 px at the bottom (caption, username, music)
and ~140 px on the right (like/comment buttons), so text stays inside those margins.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Template:
    id: int
    name: str
    background: str  # canvas colour behind everything
    image_box: tuple[int, int, int, int]  # x, y, w, h of the product photo
    panel: tuple[int, int, int, int, str, float] | None  # x, y, w, h, colour, opacity behind captions
    caption_text: str
    caption_outline: str
    caption_outline_px: int
    caption_box: bool  # True: opaque box behind each caption line (ASS BorderStyle 3)
    badge_bg: str
    badge_text: str
    end_bg: str
    end_text: str


TEMPLATES = {
    1: Template(  # Bold Night: full-bleed photo, dark band for captions, yellow price badge
        id=1, name="Bold Night", background="#111111",
        image_box=(0, 0, 1080, 1920), panel=(0, 1180, 1080, 740, "#000000", 0.55),
        caption_text="#FFFFFF", caption_outline="#000000", caption_outline_px=5, caption_box=False,
        badge_bg="#FFD60A", badge_text="#111111", end_bg="#111111", end_text="#FFD60A",
    ),
    2: Template(  # Pop Card: pink background, square photo card, black-on-white caption boxes
        id=2, name="Pop Card", background="#FF5C8A",
        image_box=(90, 250, 900, 900), panel=None,
        caption_text="#111111", caption_outline="#FFFFFF", caption_outline_px=14, caption_box=True,
        badge_bg="#111111", badge_text="#FFFFFF", end_bg="#FF5C8A", end_text="#FFFFFF",
    ),
    3: Template(  # Fresh Split: photo on top, teal panel below, orange price badge
        id=3, name="Fresh Split", background="#FFF4E0",
        image_box=(0, 0, 1080, 1120), panel=(0, 1120, 1080, 800, "#0F766E", 1.0),
        caption_text="#FFFFFF", caption_outline="#0F766E", caption_outline_px=0, caption_box=False,
        badge_bg="#F97316", badge_text="#FFFFFF", end_bg="#0F766E", end_text="#FFFFFF",
    ),
}
