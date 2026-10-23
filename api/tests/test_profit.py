import pytest

from core.profit import calculate_profit, cod_fee_paise, evaluate_product, profit_component, score, shipping_paise


def test_normal_case():
    # P ₹500, C ₹200, S ₹50, F ₹40, r 20%, A ₹60
    result = calculate_profit(50000, 20000, 5000, 4000, 0.20, 6000)
    # 0.8 * (50000 - 20000 - 5000 - 4000) - 0.2 * 2 * 5000 - 6000 = 16800 - 2000 - 6000
    assert result.profit_paise == 8800
    assert result.breakdown == {
        "revenue": 40000,
        "supplier_cost": 16000,
        "shipping": 4000,
        "fees": 3200,
        "rto_shipping_loss": 2000,
        "ad_cost": 6000,
    }


def test_breakdown_adds_up_to_profit():
    result = calculate_profit(34900, 12000, 5500, 3800, 0.25, 6000)
    costs = sum(v for k, v in result.breakdown.items() if k != "revenue")
    assert result.breakdown["revenue"] - costs == result.profit_paise


def test_high_rto_trap_loses_money():
    # 20W charger: P ₹399, C ₹210, S ₹55, F ₹42, r 30%, A ₹60
    product = {
        "selling_price_paise": 39900,
        "supplier_price_paise": 21000,
        "shipping_paise": 5500,
        "fees_paise": 4200,
        "trend_score": 50,
        "competition_score": 90,
        "supplier_reliability": 55,
    }
    out = evaluate_product(product, rto_rate=0.30, ad_cost_paise=6000)
    # 0.7 * 9200 - 0.3 * 11000 - 6000 = 6440 - 3300 - 6000
    assert out["profit_paise"] == -2860
    assert out["loss_trap"] is True
    # profit component is 0, so only the other factors count: 12.5 + 1.5 + 5.5 = 19.5 -> 20
    assert out["score"] == 20


def test_zero_rto_is_plain_margin():
    result = calculate_profit(50000, 20000, 5000, 4000, 0, 6000)
    assert result.profit_paise == 50000 - 20000 - 5000 - 4000 - 6000
    assert result.breakdown["rto_shipping_loss"] == 0


def test_full_rto_loses_double_shipping_and_ads():
    result = calculate_profit(50000, 20000, 5000, 4000, 1, 6000)
    assert result.profit_paise == -(2 * 5000) - 6000


def test_break_even_is_a_loss_trap():
    # 0 RTO, P - C - S - F - A == 0
    product = {
        "selling_price_paise": 30000,
        "supplier_price_paise": 15000,
        "shipping_paise": 5000,
        "fees_paise": 4000,
        "trend_score": 100,
        "competition_score": 0,
        "supplier_reliability": 100,
    }
    out = evaluate_product(product, rto_rate=0, ad_cost_paise=6000)
    assert out["profit_paise"] == 0
    assert out["loss_trap"] is True


@pytest.mark.parametrize(
    ("profit", "price", "expected"),
    [
        (-5000, 50000, 0),  # negative margin clamps to 0
        (0, 50000, 0),
        (7500, 50000, 50),  # 15% margin -> halfway
        (15000, 50000, 100),  # exactly 30%
        (40000, 50000, 100),  # 80% margin clamps to 100
        (1000, 0, 0),  # free product: no margin to speak of
    ],
)
def test_profit_component_clamping(profit, price, expected):
    assert profit_component(profit, price) == pytest.approx(expected)


def test_score_extremes():
    assert score(20000, 50000, trend_score=100, competition_score=0, supplier_reliability=100) == 100
    assert score(-20000, 50000, trend_score=0, competition_score=100, supplier_reliability=0) == 0


def test_score_rounds_half_up():
    # 0 + 0.25*2 + 0 + 0 = 0.5 -> 1 (Python's round() would give 0)
    assert score(0, 50000, trend_score=2, competition_score=100, supplier_reliability=0) == 1


@pytest.mark.parametrize("bad_rto", [-0.1, 1.5])
def test_rejects_invalid_rto(bad_rto):
    with pytest.raises(ValueError):
        calculate_profit(50000, 20000, 5000, 4000, bad_rto, 6000)


def test_rejects_negative_money():
    with pytest.raises(ValueError):
        calculate_profit(50000, 20000, 5000, 4000, 0.2, -1)


def test_shipping_includes_gst():
    assert shipping_paise() == 5310  # ₹45 + 18% GST


@pytest.mark.parametrize(
    ("price", "expected"),
    [
        (29900, 4366),  # ₹27 + 1.5% = ₹31.49 < ₹37 minimum → ₹37 + GST = ₹43.66
        (66700, 4367),  # just above the minimum: ₹27 + ₹10.005 = ₹37.005 + GST = ₹43.67
        (100000, 4956),  # ₹27 + ₹15 = ₹42 + GST = ₹49.56
    ],
)
def test_cod_fee(price, expected):
    assert cod_fee_paise(price) == expected
