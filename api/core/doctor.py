"""Conversion Doctor: rules find the weakest funnel stage; the LLM writes the fix and new hooks."""

import time

from pydantic import BaseModel, Field, ValidationError, ValidationInfo, field_validator, model_validator

from core.llm import LLMError, complete_json
from core.profit import cod_fee_paise
from core.reels.script import LANGUAGE_NAMES, MIN_NATIVE_SHARE, NATIVE_SCRIPT

# Benchmarks are rough industry estimates (no authoritative source exists); the UI labels them "estimate".
INTEREST_BENCHMARK = 0.045  # DMs/link clicks per Reel view
INTEREST_SOURCE = "Zebracat 2026 Reels statistics (vendor figure)"
CONVERSION_BENCHMARK = 0.10  # orders per DM/click
CONVERSION_SOURCE = "vendor studies put Instagram DM-to-sale at 10–15%; low end used"

STAGES = {
    "interest": "Viewers aren't messaging or clicking: the hook and video aren't pulling people in.",
    "conversion": "People are interested but not ordering: the chat, price or trust is losing them.",
    "returns": "Orders are coming back: COD buyers are refusing delivery more than usual.",
    "healthy": "Every stage is at or above the usual numbers: time to post more of what works.",
}


# The ready-to-send message for each stage: what the seller copies into WhatsApp/Instagram.
MESSAGES = {
    "interest": "a caption to post with the next Reel that tells viewers to DM or WhatsApp to order and says the price",
    "conversion": "a reply to send when someone DMs asking the price: price, cash on delivery, and asking for name, address and pincode",
    "returns": "a WhatsApp message to confirm each COD order before shipping it: product, price, and asking the buyer to reply YES",
    "healthy": "a WhatsApp message to delivered buyers asking for a photo or short review of the product",
}


ADVICE_BUDGET_SECONDS = 50


class FunnelError(ValueError):
    """The numbers don't make sense together. Message is safe to show to sellers."""


def diagnose(views: int, clicks: int, orders: int, returns: int, rto_benchmark: float, rto_source: str) -> dict:
    """Pure: compare each stage with its benchmark (ratio < 1 means worse than usual) and pick the weakest."""
    if views <= 0:
        raise FunnelError("Enter how many people viewed your Reel (more than 0).")
    if clicks > views:
        raise FunnelError("Clicks/DMs can't be more than views. Please check the numbers.")
    if returns > orders:
        raise FunnelError("Returns can't be more than orders. Please check the numbers.")

    stages = {
        "interest": {"rate": clicks / views, "benchmark": INTEREST_BENCHMARK, "source": INTEREST_SOURCE},
    }
    if clicks > 0:  # orders can also come straight from WhatsApp; only judge conversion when there were clicks
        stages["conversion"] = {"rate": orders / clicks, "benchmark": CONVERSION_BENCHMARK, "source": CONVERSION_SOURCE}
    if orders > 0:
        stages["returns"] = {"rate": returns / orders, "benchmark": rto_benchmark, "source": rto_source,
                             "lower_is_better": True}
    for s in stages.values():
        if s.get("lower_is_better"):
            s["ratio"] = s["benchmark"] / s["rate"] if s["rate"] > 0 else float("inf")
        else:
            s["ratio"] = s["rate"] / s["benchmark"]
        s["rate"] = round(s["rate"], 4)
        s["ratio"] = round(s["ratio"], 3) if s["ratio"] != float("inf") else None  # None = perfect (no returns)

    weakest = min(stages, key=lambda k: stages[k]["ratio"] if stages[k]["ratio"] is not None else float("inf"))
    ratio = stages[weakest]["ratio"]
    stage = weakest if ratio is not None and ratio < 1 else "healthy"
    return {"stage": stage, "summary": STAGES[stage], "stages": stages}


def money_result(orders: int, returns: int, price_paise: int, supplier_paise: int, shipping_paise: int,
                 ad_spend_paise: int) -> dict:
    """Pure: what these orders actually earned, in paise. Same cost model as core.profit, applied to real counts:
    delivered orders pay product cost, one-way shipping and the COD fee; returned orders cost shipping both ways
    (the product comes back and the COD fee is reversed)."""
    delivered = orders - returns
    fee = cod_fee_paise(price_paise)
    money = {
        "delivered": delivered,
        "sales_paise": delivered * price_paise,
        "product_cost_paise": delivered * supplier_paise,
        "shipping_paise": (delivered + 2 * returns) * shipping_paise,
        "cod_fees_paise": delivered * fee,
        "ad_spend_paise": ad_spend_paise,
        "returns_cost_paise": 2 * returns * shipping_paise,
        "per_delivered_paise": price_paise - supplier_paise - shipping_paise - fee,
        "price_paise": price_paise,
    }
    money["profit_paise"] = (money["sales_paise"] - money["product_cost_paise"] - money["shipping_paise"]
                             - money["cod_fees_paise"] - ad_spend_paise)
    return money


class DoctorAdvice(BaseModel):
    explanation: str = Field(min_length=10, max_length=400)
    fixes: list[str] = Field(min_length=3, max_length=3)
    hooks: list[str] = Field(min_length=3, max_length=3)
    message: str = Field(min_length=10, max_length=600)

    @field_validator("message")
    @classmethod
    def _tidy(cls, v: str) -> str:
        return "\n".join(" ".join(line.split()) for line in v.strip().splitlines())

    @field_validator("fixes", "hooks", mode="before")
    @classmethod
    def _trim_extras(cls, v):
        return v[:3] if isinstance(v, list) else v

    @field_validator("fixes", "hooks")
    @classmethod
    def _clean(cls, v: list[str]) -> list[str]:
        v = [" ".join(x.split()) for x in v]
        if any(not 3 <= len(x) <= 160 for x in v):
            raise ValueError("each item must be one short sentence")
        return v

    @model_validator(mode="after")
    def _native(self, info: ValidationInfo) -> "DoctorAdvice":
        native = NATIVE_SCRIPT.get((info.context or {}).get("language", ""))
        if native:
            low, high, name = native
            for line in [self.explanation, *self.fixes, *self.hooks, self.message]:
                letters = [c for c in line if c.isalpha()]
                if sum(low <= c <= high for c in letters) / max(len(letters), 1) < MIN_NATIVE_SHARE:
                    raise ValueError(f"write everything in {name}; this isn't: {line!r}")
        return self


def write_advice(result: dict, numbers: dict, product: dict, language: str, price_paise: int,
                 usage: dict | None = None) -> DoctorAdvice:
    name = LANGUAGE_NAMES[language]
    script_rule = f"Write in {name} using {NATIVE_SCRIPT[language][2]}." if language in NATIVE_SCRIPT else "Write in simple Indian English."
    system = f"""You coach first-time Instagram/WhatsApp sellers in India. They sell cash-on-delivery products through Reels.
{script_rule} Talk like a friendly mentor: short, practical, no jargon, no English marketing terms unless people say them aloud.

Return JSON with:
- explanation: 1–2 sentences on what the numbers mean for this stage.
- fixes: exactly 3 concrete actions the seller can do this week for this stage (each one sentence).
- hooks: exactly 3 new Reel opening lines (max 8 words each) that grab attention in 2 seconds.
- message: {MESSAGES[result['stage']]}. Ready to send as is: no placeholders like [name], 2–5 short lines, at most 2 emojis.
Never promise results, invent discounts, offers or delivery times, or suggest paid ads unless the stage is "healthy"."""
    stages = "\n".join(
        f"- {k}: seller {v['rate']:.1%} vs usual {v['benchmark']:.1%}" for k, v in result["stages"].items()
    )
    user = (f"Product: {product['name']} ({product['category'].replace('_', ' ')}), selling price ₹{price_paise // 100}\n"
            f"Numbers: {numbers['views']} views, {numbers['clicks']} clicks/DMs, {numbers['orders']} orders, "
            f"{numbers['returns']} returned\nStages:\n{stages}\n"
            f"Weakest stage: {result['stage']} — {result['summary']}")
    feedback = ""
    started = time.monotonic()
    for attempt in range(2):
        if attempt and time.monotonic() - started > ADVICE_BUDGET_SECONDS / 2:
            break  # a second try would leave the seller waiting too long
        data = complete_json(system, user + feedback, temperature=0.7, usage=usage)
        try:
            return DoctorAdvice.model_validate(data, context={"language": language})
        except ValidationError as e:
            problems = "; ".join(f"{'.'.join(map(str, err['loc'])) or 'answer'}: {err['msg']}" for err in e.errors()[:5])
            feedback = f"\n\nYour previous answer was rejected: {problems}. Fix these and reply again."
    raise LLMError("We couldn't write advice this time. Please try again.")
