import pytest

from core.llm import LLMError
from core.reels import script as script_mod
from core.reels.script import ReelScript, generate_script, rupees

PRODUCT = {"name": "Rechargeable Lint Remover", "category": "home_gadgets", "selling_price_paise": 45900}
ML = {
    "hook": "സ്വെറ്ററിൽ നിറയെ ഗുളികകളാണോ?",
    "benefits": ["ഒറ്റ ചാർജിൽ ഒരുപാട് ഡ്രസ്സുകൾ ക്ലീൻ.", "പഴയ സ്വെറ്റർ പുത്തനാകും.", "കയ്യിൽ ഒതുങ്ങുന്ന സൈസ്."],
    "price_line": "വെറും ₹459, ക്യാഷ് ഓൺ ഡെലിവറി ഉണ്ട്.",
    "cta": "ഇപ്പോൾ തന്നെ DM ചെയ്യൂ!",
    "sentences": ["whatever order the model chose"],
    "caption": "പഴയ ഡ്രസ്സുകൾക്ക് പുതിയ ലുക്ക് ✨",
    "hashtags": ["kerala", "#kochi", "lint remover", "#homehacks", "#malayali", "#keralashopping",
                 "#codavailable", "#sweatercare", "#mallugram", "#trivandrum"],
}
CTX = {"language": "ml", "price_digits": "459"}


def test_valid_malayalam_script_and_canonical_sentence_order():
    s = ReelScript.model_validate(ML, context=CTX)
    assert s.sentences == [ML["hook"], *ML["benefits"], ML["price_line"], ML["cta"]]
    assert s.hashtags[0] == "#kerala" and s.hashtags[2] == "#lintremover"


def test_rejects_english_letters_for_malayalam():
    bad = ML | {"hook": "Is your sweater full of lint balls?"}
    with pytest.raises(ValueError, match="Malayalam script"):
        ReelScript.model_validate(bad, context=CTX)


def test_allows_short_english_loanwords_in_malayalam():
    ReelScript.model_validate(ML | {"cta": "ഇപ്പോൾ തന്നെ DM ചെയ്യൂ, COD ഉണ്ട്!"}, context=CTX)


def test_price_line_must_contain_price_digits():
    with pytest.raises(ValueError, match="459"):
        ReelScript.model_validate(ML | {"price_line": "വളരെ കുറഞ്ഞ വില, COD ഉണ്ട്."}, context=CTX)


def test_needs_three_benefits_and_ten_hashtags():
    with pytest.raises(ValueError):
        ReelScript.model_validate(ML | {"benefits": ML["benefits"][:2]}, context=CTX)
    with pytest.raises(ValueError):
        ReelScript.model_validate(ML | {"hashtags": ML["hashtags"][:9]}, context=CTX)


def test_extra_benefits_and_hashtags_are_trimmed_not_rejected():
    s = ReelScript.model_validate(ML | {"benefits": ML["benefits"] + ["നാലാമത്തെ ഗുണം."],
                                        "hashtags": ML["hashtags"] + ["#extra"]}, context=CTX)
    assert len(s.benefits) == 3 and len(s.hashtags) == 10 and "#extra" not in s.hashtags


def test_rejects_scripts_too_long_for_30_seconds():
    long = "ഇത് വളരെ നീളമുള്ള ഒരു വാചകം ആണ് " * 4  # 128 chars: each benefit is valid, together too long
    with pytest.raises(ValueError, match="too long"):
        ReelScript.model_validate(ML | {"benefits": [long, long, long]}, context=CTX)


def test_generate_retries_once_with_feedback(monkeypatch):
    replies = [ML | {"hook": "English hook here"}, ML]
    prompts = []

    def fake(system, user, temperature, usage):
        prompts.append(user)
        return replies.pop(0)

    monkeypatch.setattr(script_mod, "complete_json", fake)
    s = generate_script(PRODUCT, "college girls in Kochi", "ml")
    assert s.hook == ML["hook"]
    assert "Price: ₹459" in prompts[0] and "college girls in Kochi" in prompts[0]
    assert "rejected" in prompts[1] and "Malayalam script" in prompts[1]


def test_generate_gives_up_after_two_invalid_answers(monkeypatch):
    monkeypatch.setattr(script_mod, "complete_json", lambda *a, **k: ML | {"cta": "Order now"})
    with pytest.raises(LLMError, match="couldn't write a good script"):
        generate_script(PRODUCT, "anyone", "ml")


def test_rupees():
    assert rupees(45900) == "₹459" and rupees(45950) == "₹459.50"
