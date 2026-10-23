"""Real Profit Score. Pure functions only: no I/O, all money in integer paise.

Expected profit per order placed:
    profit = (1 - r) * (P - C - S - F) - r * 2 * S - A
P selling price, C supplier cost, S one-way shipping, F COD + gateway + GST fees,
r RTO (return-to-origin) rate, A ad cost per order.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

MARGIN_FOR_FULL_SCORE = Decimal("0.30")


@dataclass(frozen=True)
class ProfitResult:
    profit_paise: int
    # Expected paise per order placed. revenue - (every other key) == profit_paise.
    breakdown: dict[str, int]


def _paise(x: Decimal) -> int:
    return int(x.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def calculate_profit(
    selling_price_paise: int,
    supplier_price_paise: int,
    shipping_paise: int,
    fees_paise: int,
    rto_rate: float | Decimal,
    ad_cost_paise: int,
) -> ProfitResult:
    r = Decimal(str(rto_rate))
    if not 0 <= r <= 1:
        raise ValueError("RTO rate must be between 0 and 1")
    if min(selling_price_paise, supplier_price_paise, shipping_paise, fees_paise, ad_cost_paise) < 0:
        raise ValueError("Prices and costs cannot be negative")

    delivered = 1 - r
    breakdown = {
        "revenue": _paise(delivered * selling_price_paise),
        "supplier_cost": _paise(delivered * supplier_price_paise),
        "shipping": _paise(delivered * shipping_paise),
        "fees": _paise(delivered * fees_paise),
        "rto_shipping_loss": _paise(r * 2 * shipping_paise),
        "ad_cost": ad_cost_paise,
    }
    # Derived from the rounded parts so the breakdown always adds up exactly.
    profit = breakdown["revenue"] - sum(v for k, v in breakdown.items() if k != "revenue")
    return ProfitResult(profit_paise=profit, breakdown=breakdown)


def profit_component(profit_paise: int, selling_price_paise: int) -> float:
    """Margin mapped linearly: <= 0% -> 0, >= 30% -> 100."""
    if selling_price_paise <= 0:
        return 0.0
    margin = Decimal(profit_paise) / selling_price_paise
    return float(min(max(margin / MARGIN_FOR_FULL_SCORE, 0), 1) * 100)


def score(
    profit_paise: int,
    selling_price_paise: int,
    trend_score: int,
    competition_score: int,
    supplier_reliability: int,
) -> int:
    raw = (
        Decimal("0.50") * Decimal(str(profit_component(profit_paise, selling_price_paise)))
        + Decimal("0.25") * trend_score
        + Decimal("0.15") * (100 - competition_score)
        + Decimal("0.10") * supplier_reliability
    )
    return _paise(raw)  # same half-up rounding, to a whole score point


def evaluate_product(product: dict, rto_rate: float, ad_cost_paise: int) -> dict:
    """Profit, score and breakdown for one products-table row."""
    result = calculate_profit(
        selling_price_paise=product["selling_price_paise"],
        supplier_price_paise=product["supplier_price_paise"],
        shipping_paise=product["shipping_paise"],
        fees_paise=product["fees_paise"],
        rto_rate=rto_rate,
        ad_cost_paise=ad_cost_paise,
    )
    return {
        "score": score(
            result.profit_paise,
            product["selling_price_paise"],
            product["trend_score"],
            product["competition_score"],
            product["supplier_reliability"],
        ),
        "profit_paise": result.profit_paise,
        "loss_trap": result.profit_paise <= 0,
        "breakdown": result.breakdown,
    }
