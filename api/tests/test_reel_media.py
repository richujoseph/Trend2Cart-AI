import pytest

from core.reels import ReelJobError
from core.reels.captions import ass_colour, ass_text, ass_time, build_ass
from core.reels.pipeline import costs_paise, reel_length
from core.reels.templates import TEMPLATES
from core.reels.voice import GAP, LEAD_IN, plan_timings

SENTENCES = ["hook", "b1", "b2", "b3", "price {\\b1}", "cta"]


def test_plan_timings_no_speedup():
    timings, total, tempo = plan_timings([2.0, 3.0, 3.0, 3.0, 3.0, 2.0])
    assert tempo == 1.0
    assert timings[0] == (LEAD_IN, LEAD_IN + 2.0)
    assert timings[1][0] == pytest.approx(LEAD_IN + 2.0 + GAP)
    assert total == pytest.approx(LEAD_IN + 16.0 + 5 * GAP)


def test_plan_timings_speeds_up_long_voice_to_28s():
    timings, total, tempo = plan_timings([5.0] * 6)  # 0.3 + 30 + 1.25 = 31.55 s
    assert tempo == pytest.approx(31.55 / 28.0, abs=1e-3)
    assert total == pytest.approx(28.0, abs=0.01)
    assert timings[-1][1] == pytest.approx(28.0, abs=0.01)


def test_plan_timings_refuses_way_too_long_voice():
    with pytest.raises(ReelJobError, match="too long"):
        plan_timings([7.0] * 6)


@pytest.mark.parametrize(("voice", "expected"), [(8.0, 15.0), (20.0, 20.8), (29.5, 30.0)])
def test_reel_length_is_15_to_30_seconds(voice, expected):
    assert reel_length(voice) == expected


def test_ass_helpers():
    assert ass_time(12.345) == "0:00:12.35"
    assert ass_time(3725.5) == "1:02:05.50"
    assert ass_colour("#FFD60A") == "&H000AD6FF"
    assert ass_colour("#000000", 0.5) == "&H80000000"
    assert ass_text("₹459 {\\pos(1,1)} ok\\N") == "₹459 (/pos(1,1)) ok/N"


def test_build_ass_events():
    timings = [(0.3, 2.0), (2.25, 5.0), (5.25, 8.0), (8.25, 11.0), (11.25, 14.0), (14.25, 16.0)]
    ass = build_ass(template=TEMPLATES[1], language="ml", sentences=SENTENCES, timings=timings,
                    duration=16.8, end_card_start=13.8, price_text="₹459", cta="DM now")
    dialogue = [line for line in ass.splitlines() if line.startswith("Dialogue")]
    captions = [d for d in dialogue if ",Caption," in d]
    assert len(captions) == 5  # CTA is not a caption; it's on the end card
    assert captions[0].startswith("Dialogue: 0,0:00:00.30,0:00:02.25,Caption")  # held until next line starts
    assert captions[-1].endswith("price (/b1)") and ",0:00:13.80,Caption" in captions[-1]  # clipped at end card
    assert any(",Price,," in d and d.startswith("Dialogue: 0,0:00:11.25,0:00:13.80") for d in dialogue)
    assert any(",EndCTA,," in d and d.endswith("DM now") for d in dialogue)
    assert "Style: Caption,Noto Sans Malayalam,72" in ass
    assert not any(",Title,," in d for d in dialogue)


def test_title_card_when_no_photos():
    ass = build_ass(template=TEMPLATES[2], language="hi", sentences=SENTENCES, timings=[(0, 1)] * 6,
                    duration=15, end_card_start=12, price_text="₹99", cta="cta", product_name="Ice Roller")
    assert "Dialogue: 0,0:00:00.00,0:00:12.00,Title,,0,0,0,,Ice Roller" in ass
    assert "Style: Caption,Mukta," in ass


def test_costs(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "a")
    from core.config import get_settings

    get_settings.cache_clear()
    # Sarvam ₹30 / 10k chars → 300 chars = 900 paise... no: 300 * 3000 / 10000 = 90 paise
    assert costs_paise({"prompt_tokens": 900, "completion_tokens": 400}, 300) == {"llm": 0, "tts": 90, "total": 90}
    get_settings.cache_clear()
