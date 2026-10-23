"""Three Reel looks. Layout numbers are pixels on a 1080x1920 canvas.

Safe areas: Instagram covers ~200 px at the top, ~420 px at the bottom (caption, username, music)
and ~140 px on the right (like/comment buttons), so text stays inside those margins.

Each product photo becomes a "scene": the whole photo on a rounded card (never cropped, never stretched
to full screen, so small supplier photos stay sharp) over a backdrop made from the same photo.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Template:
    id: int
    name: str
    # Scene composition (drawn with Pillow, see render.compose_scene)
    backdrop: str  # "blur_dark": blurred photo, darkened | "solid": flat colour | "blur_light": blurred photo, washed out
    background: str  # solid colour (and tint for the light backdrop)
    card_box: tuple[int, int, int, int]  # x, y, w, h the photo is fitted inside
    card_border: int  # white frame around the photo (polaroid look); 0 = none
    card_tilt: float  # degrees
    panel: tuple[int, int, int, int, str] | None  # x, y, w, h, colour drawn under the captions
    bottom_fade: bool  # dark gradient behind captions
    # Text
    caption_text: str
    caption_highlight: str  # colour each word turns as it's spoken
    caption_outline: str
    caption_outline_px: int
    caption_box: bool  # True: opaque box behind each caption line (ASS BorderStyle 3)
    badge_bg: str
    badge_text: str
    end_bg: str
    end_text: str
    accent: str  # end-card button + progress bar


TEMPLATES = {
    1: Template(  # Bold Night: blurred dark backdrop, big card, yellow highlights
        id=1, name="Bold Night", backdrop="blur_dark", background="#111111",
        card_box=(110, 260, 860, 900), card_border=0, card_tilt=0, panel=None, bottom_fade=True,
        caption_text="#FFFFFF", caption_highlight="#FFD60A", caption_outline="#000000", caption_outline_px=5,
        caption_box=False, badge_bg="#FFD60A", badge_text="#111111", end_bg="#111111", end_text="#FFFFFF",
        accent="#FFD60A",
    ),
    2: Template(  # Pop Card: pink background, tilted polaroid, black-on-white caption boxes
        id=2, name="Pop Card", backdrop="solid", background="#FF5C8A",
        card_box=(120, 250, 840, 880), card_border=26, card_tilt=-2.5, panel=None, bottom_fade=False,
        caption_text="#111111", caption_highlight="#FF2E6C", caption_outline="#FFFFFF", caption_outline_px=14,
        caption_box=True, badge_bg="#111111", badge_text="#FFFFFF", end_bg="#FF5C8A", end_text="#FFFFFF",
        accent="#111111",
    ),
    3: Template(  # Fresh Split: light blurred top with the card, teal panel below, orange highlights
        id=3, name="Fresh Split", backdrop="blur_light", background="#FFF4E0",
        card_box=(160, 230, 760, 820), card_border=0, card_tilt=0, panel=(0, 1150, 1080, 770, "#0F766E"),
        bottom_fade=False,
        caption_text="#FFFFFF", caption_highlight="#FDBA74", caption_outline="#0F766E", caption_outline_px=0,
        caption_box=False, badge_bg="#F97316", badge_text="#FFFFFF", end_bg="#0F766E", end_text="#FFFFFF",
        accent="#F97316",
    ),
}
