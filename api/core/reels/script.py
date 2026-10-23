"""Reel script: one LLM call that must return strict JSON, validated with Pydantic, retried once."""

import re

from pydantic import BaseModel, Field, ValidationError, ValidationInfo, field_validator, model_validator

from core.llm import LLMError, complete_json

LANGUAGE_NAMES = {"ml": "Malayalam", "hi": "Hindi", "en": "English"}
NATIVE_SCRIPT = {"ml": ("ഀ", "ൿ", "Malayalam script"), "hi": ("ऀ", "ॿ", "Devanagari script")}
MIN_NATIVE_SHARE = 0.6  # loanwords like "COD" are fine, but most letters must be native script
MAX_SPOKEN_CHARS = 380  # ~30 s of speech; the voice step speeds up slightly if needed


def rupees(paise: int) -> str:
    """45900 → "₹459", 45950 → "₹459.50"."""
    return f"₹{paise // 100}" if paise % 100 == 0 else f"₹{paise / 100:.2f}"


class ReelScript(BaseModel):
    hook: str = Field(min_length=3, max_length=100)
    benefits: list[str] = Field(min_length=3, max_length=3)
    price_line: str = Field(min_length=3, max_length=140)
    cta: str = Field(min_length=3, max_length=100)
    # Always rebuilt as [hook, *benefits, price_line, cta]: captions, the price badge and the
    # end card are timed by position, so the order can't be left to the model.
    sentences: list[str] = Field(default_factory=list)
    caption: str = Field(min_length=10, max_length=700)
    hashtags: list[str] = Field(min_length=10, max_length=10)

    @field_validator("benefits", "hashtags", mode="before")
    @classmethod
    def _trim_extras(cls, v, info: ValidationInfo):
        # Models sometimes return 4 benefits or 11 hashtags; keep the first ones instead of failing the Reel.
        limit = 3 if info.field_name == "benefits" else 10
        return v[:limit] if isinstance(v, list) else v

    @field_validator("hook", "price_line", "cta", "caption")
    @classmethod
    def _strip(cls, v: str) -> str:
        return " ".join(v.split())

    @field_validator("benefits")
    @classmethod
    def _benefits(cls, v: list[str]) -> list[str]:
        v = [" ".join(b.split()) for b in v]
        if any(not 3 <= len(b) <= 140 for b in v):
            raise ValueError("each benefit must be one short sentence")
        return v

    @field_validator("hashtags")
    @classmethod
    def _hashtags(cls, v: list[str]) -> list[str]:
        tags = ["#" + re.sub(r"[\s#]+", "", t) for t in v]
        if any(len(t) < 2 for t in tags) or len({t.lower() for t in tags}) != len(tags):
            raise ValueError("hashtags must be 10 different, non-empty tags")
        return tags

    @model_validator(mode="after")
    def _checks(self, info: ValidationInfo) -> "ReelScript":
        self.sentences = [self.hook, *self.benefits, self.price_line, self.cta]
        ctx = info.context or {}
        if sum(len(s) for s in self.sentences) > MAX_SPOKEN_CHARS:
            raise ValueError(f"spoken lines are too long for 30 seconds (max {MAX_SPOKEN_CHARS} characters in total)")
        price_digits = ctx.get("price_digits")
        if price_digits and price_digits not in self.price_line.replace(",", ""):
            raise ValueError(f"price_line must contain the price written as digits: {price_digits}")
        native = NATIVE_SCRIPT.get(ctx.get("language", ""))
        if native:
            low, high, name = native
            for line in self.sentences:
                letters = [c for c in line if c.isalpha()]
                share = sum(low <= c <= high for c in letters) / max(len(letters), 1)
                if share < MIN_NATIVE_SHARE:
                    raise ValueError(f"every spoken line must be written in {name}; this one isn't: {line!r}")
        return self


def _system_prompt(language: str) -> str:
    name = LANGUAGE_NAMES[language]
    script_rule = (
        f"Write every spoken line in {name} using {NATIVE_SCRIPT[language][2]} (not English letters). "
        "Common English shopping words people say aloud (order, COD, delivery, DM) are fine, "
        f"written in {NATIVE_SCRIPT[language][2]}."
        if language in NATIVE_SCRIPT
        else "Write in simple Indian English."
    )
    return f"""You write scripts for 15–30 second vertical Instagram Reels that help small Instagram/WhatsApp sellers in India sell one product.

Rules:
- {script_rule}
- Sound like a friend talking: casual, warm, everyday spoken {name}. Never formal, literary or news-reader style.
- hook: at most 8 words. It must grab attention within 2 seconds: a question, a surprise or a pain point the audience feels. Don't open with a greeting or the product name.
- benefits: exactly 3, each one short spoken sentence (max 12 words), concrete and believable.
- price_line: at most 10 words. Say the price exactly as given (digits with ₹, e.g. ₹459) and that Cash on Delivery is available. Don't add the word for rupees after the ₹ amount.
- cta: at most 8 words telling them to DM or WhatsApp to order now.
- Keep all spoken lines together around 50–70 words.
- caption: an Instagram caption in {name}, 1–3 short lines, emojis welcome.
- hashtags: exactly 10, no spaces, relevant to the product and the audience's city/region; mix English and local-language tags.
- sentences: all spoken lines in order: hook, the 3 benefits, price_line, cta.
- Never invent discounts, free gifts, certifications, brand names or medical/health claims.

Return JSON with exactly these keys: hook, benefits, price_line, cta, sentences, caption, hashtags."""


def generate_script(product: dict, audience: str, language: str, usage: dict | None = None,
                    hook_idea: str | None = None) -> ReelScript:
    price = rupees(product["selling_price_paise"])
    user = (
        f"Product: {product['name']}\n"
        f"Category: {product['category'].replace('_', ' ')}\n"
        f"Price: {price}\n"
        f"Audience: {audience}\n"
        f"Language: {LANGUAGE_NAMES[language]}"
    )
    if hook_idea:
        user += f"\nThe seller wants this opening line as the hook (keep it, translating only if it isn't in {LANGUAGE_NAMES[language]}): {hook_idea}"
    context = {"language": language, "price_digits": price.lstrip("₹").split(".")[0]}
    feedback = ""
    for _ in range(2):
        data = complete_json(_system_prompt(language), user + feedback, temperature=0.8, usage=usage)
        try:
            return ReelScript.model_validate(data, context=context)
        except ValidationError as e:
            problems = "; ".join(f"{'.'.join(map(str, err['loc'])) or 'answer'}: {err['msg']}" for err in e.errors()[:5])
            feedback = f"\n\nYour previous answer was rejected: {problems}. Fix these and reply again."
    raise LLMError("We couldn't write a good script this time. Please try again.")
