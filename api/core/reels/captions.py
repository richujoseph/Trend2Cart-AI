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


def karaoke(line: str, start: float, end: float) -> str:
    """Word-by-word highlight: each word gets a \\k duration proportional to its length (spoken time is
    only measured per sentence, and longer words take longer to say)."""
    words = line.split()
    total = max(round((end - start) * 100), len(words))
    weights = [len(w) + 1 for w in words]
    durations = [max(1, total * w // sum(weights)) for w in weights]
    durations[-1] = max(1, total - sum(durations[:-1]))
    return " ".join(f"{{\\k{d}}}{ass_text(w)}" for d, w in zip(durations, words))


def _readable_on(background: str) -> str:
    """Black or white text, whichever reads better on `background` (perceived luminance)."""
    r, g, b = (int(background[i:i + 2], 16) for i in (1, 3, 5))
    return "#111111" if 0.299 * r + 0.587 * g + 0.114 * b > 150 else "#FFFFFF"


POP_IN = "\\fad(120,60)\\fscx88\\fscy88\\t(0,160,\\fscx100\\fscy100)"
BOUNCE_IN = "\\fad(80,0)\\fscx30\\fscy30\\t(0,200,\\fscx118\\fscy118)\\t(200,340,\\fscx100\\fscy100)"


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
    bases = {"caption": 72, "hook": 86, "cta": 76, "title": 100}
    size = {name: round(base * FONT_SCALE[language]) for name, base in bases.items()}
    border_style = 3 if t.caption_box else 1
    caption_back = ass_colour(t.caption_outline) if t.caption_box else ass_colour("#000000", 0.5)
    # Karaoke: SecondaryColour before a word is spoken, PrimaryColour (highlight) after.
    caption_colours = f"{ass_colour(t.caption_highlight)},{ass_colour(t.caption_text)},{ass_colour(t.caption_outline)},{caption_back}"
    button_text = _readable_on(t.accent)
    styles = [
        # Name, Font, Size, Primary, Secondary, Outline, Back, Bold, Italic, Underline, Strike,
        # ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
        f"Style: Caption,{font},{size['caption']},{caption_colours},-1,0,0,0,100,100,0,0,{border_style},"
        f"{t.caption_outline_px},0,2,80,140,400,1",
        f"Style: Hook,{font},{size['hook']},{caption_colours},-1,0,0,0,100,100,0,0,{border_style},"
        f"{t.caption_outline_px + (2 if not t.caption_box else 0)},0,2,70,130,400,1",
        f"Style: Price,{LATIN_FONT},120,{ass_colour(t.badge_text)},{ass_colour(t.badge_text)},"
        f"{ass_colour(t.badge_bg)},{ass_colour(t.badge_bg)},-1,0,0,0,100,100,0,0,3,26,0,8,80,140,230,1",
        f"Style: EndPrice,{LATIN_FONT},150,{ass_colour(t.end_text)},{ass_colour(t.end_text)},"
        f"{ass_colour(t.end_bg)},{ass_colour(t.end_bg)},-1,0,0,0,100,100,0,0,1,0,0,5,100,100,0,1",
        # A filled "button": opaque box (BorderStyle 3) in the accent colour, padded by the outline width.
        f"Style: EndCTA,{font},{size['cta']},{ass_colour(button_text)},{ass_colour(button_text)},"
        f"{ass_colour(t.accent)},{ass_colour(t.accent)},-1,0,0,0,100,100,0,0,3,30,0,5,120,120,0,1",
        f"Style: Title,{font},{size['title']},{ass_colour('#FFFFFF')},{ass_colour('#FFFFFF')},"
        f"{ass_colour('#000000')},{ass_colour('#000000', 0.5)},-1,0,0,0,100,100,0,0,1,4,0,5,100,100,0,1",
    ]

    events = []
    price_index = len(sentences) - 2  # order is [hook, b1, b2, b3, price_line, cta]
    for i, ((start, end), line) in enumerate(zip(timings, sentences)):
        if i == len(sentences) - 1:
            continue  # the CTA is shown as a button on the end card instead
        next_start = timings[i + 1][0] if i + 1 < len(timings) else end
        events.append(("Hook" if i == 0 else "Caption", start, min(max(end, next_start), end_card_start),
                       f"{{{POP_IN}}}" + karaoke(line, start, end)))
    events.append(("Price", timings[price_index][0], end_card_start, f"{{{BOUNCE_IN}}}{ass_text(price_text)}"))
    events.append(("EndPrice", end_card_start, duration,
                   f"{{\\move(540,700,540,640,0,300)\\fad(150,0)}}{ass_text(price_text)}"))
    events.append(("EndCTA", end_card_start, duration,
                   f"{{\\move(540,1040,540,960,120,420)\\fad(250,0)}}{ass_text(cta)}"))
    if product_name:
        events.append(("Title", 0, end_card_start, f"{{\\pos(540,760)\\fad(300,0)}}{ass_text(product_name)}"))

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
            lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{text}")
    return "\n".join(lines) + "\n"
