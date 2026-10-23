"""ASS subtitle file for a Reel: spoken captions, price badge, end card and (no-photo) title card."""

from core.reels.templates import Template

# Hindi uses Mukta: one font for Devanagari *and* Latin, so loanwords like "COD" match the caption size.
# (Noto Sans Devanagari has no Latin letters, and the Noto Sans fallback rendered about twice as large.)
FONTS = {"ml": "Noto Sans Malayalam", "hi": "Mukta", "en": "Noto Sans"}
# Fonts draw at different visual sizes for the same point size; these even them out (Mukta renders small).
FONT_SCALE = {"ml": 1.0, "hi": 1.35, "en": 1.1}
LATIN_FONT = "Noto Sans"  # for ₹ prices; libass falls back to it for Latin letters inside Indic captions


def ass_time(seconds: float) -> str:
    """12.345 → "0:00:12.35" (ASS uses centiseconds)."""
    cs = int(max(seconds, 0) * 100 + 0.5 + 1e-6)  # half-up; 12.345*100 is 1234.4999… in floats
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ass_colour(hex_rgb: str, opacity: float = 1.0) -> str:
    """"#RRGGBB" → ASS "&HAABBGGRR" (AA = transparency, 00 = opaque)."""
    r, g, b = hex_rgb[1:3], hex_rgb[3:5], hex_rgb[5:7]
    return f"&H{round((1 - opacity) * 255):02X}{b}{g}{r}".upper()


def ass_text(text: str) -> str:
    """Neutralise ASS control characters so seller/LLM text can't inject override tags."""
    return " ".join(text.replace("\\", "/").replace("{", "(").replace("}", ")").split())


def build_ass(
    *,
    template: Template,
    language: str,
    sentences: list[str],
    timings: list[tuple[float, float]],
    duration: float,
    end_card_start: float,
    price_text: str,
    cta: str,
    product_name: str | None = None,  # set when there are no photos: shown as a title card
) -> str:
    t = template
    font = FONTS[language]
    size = {name: round(base * FONT_SCALE[language]) for name, base in {"caption": 72, "cta": 92, "title": 96}.items()}
    border_style = 3 if t.caption_box else 1
    caption_back = ass_colour(t.caption_outline) if t.caption_box else ass_colour("#000000", 0.5)
    styles = [
        # Name, Font, Size, Primary, Secondary, Outline, Back, Bold, Italic, Underline, Strike,
        # ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
        f"Style: Caption,{font},{size['caption']},{ass_colour(t.caption_text)},{ass_colour(t.caption_text)},"
        f"{ass_colour(t.caption_outline)},{caption_back},-1,0,0,0,100,100,0,0,{border_style},"
        f"{t.caption_outline_px},0,2,80,140,400,1",
        f"Style: Price,{LATIN_FONT},120,{ass_colour(t.badge_text)},{ass_colour(t.badge_text)},"
        f"{ass_colour(t.badge_bg)},{ass_colour(t.badge_bg)},-1,0,0,0,100,100,0,0,3,26,0,8,80,140,230,1",
        f"Style: EndCTA,{font},{size['cta']},{ass_colour(t.end_text)},{ass_colour(t.end_text)},"
        f"{ass_colour(t.end_bg)},{ass_colour(t.end_bg)},-1,0,0,0,100,100,0,0,1,0,0,5,100,100,0,1",
        f"Style: EndPrice,{LATIN_FONT},140,{ass_colour(t.end_text)},{ass_colour(t.end_text)},"
        f"{ass_colour(t.end_bg)},{ass_colour(t.end_bg)},-1,0,0,0,100,100,0,0,1,0,0,8,100,100,520,1",
        f"Style: Title,{font},{size['title']},{ass_colour(t.caption_text)},{ass_colour(t.caption_text)},"
        f"{ass_colour('#000000')},{ass_colour('#000000', 0.5)},-1,0,0,0,100,100,0,0,1,4,0,5,100,100,0,1",
    ]

    events = []
    price_index = len(sentences) - 2  # order is [hook, b1, b2, b3, price_line, cta]
    for i, ((start, end), line) in enumerate(zip(timings, sentences)):
        if i == len(sentences) - 1:
            continue  # the CTA is shown big on the end card instead
        next_start = timings[i + 1][0] if i + 1 < len(timings) else end
        events.append(("Caption", start, min(max(end, next_start), end_card_start), line))
    events.append(("Price", timings[price_index][0], end_card_start, price_text))
    events.append(("EndPrice", end_card_start, duration, price_text))
    events.append(("EndCTA", end_card_start, duration, cta))
    if product_name:
        events.append(("Title", 0, end_card_start, product_name))

    lines = [
        "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1080", "PlayResY: 1920", "WrapStyle: 0",
        "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, "
        "Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
        "MarginL, MarginR, MarginV, Encoding",
        *styles, "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for style, start, end, text in events:
        if end > start:
            lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{ass_text(text)}")
    return "\n".join(lines) + "\n"
