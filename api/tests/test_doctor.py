import pytest

from core import doctor
from core.doctor import DoctorAdvice, FunnelError, diagnose, money_result

RTO = (0.20, "category estimate")


def test_weak_interest():
    r = diagnose(10000, 100, 20, 2, *RTO)  # 1% clicks vs 4.5%
    assert r["stage"] == "interest"
    assert r["stages"]["interest"]["rate"] == 0.01
    assert r["stages"]["interest"]["ratio"] == pytest.approx(0.222, abs=1e-3)


def test_weak_conversion():
    r = diagnose(10000, 600, 12, 1, *RTO)  # 6% clicks (fine), 2% orders vs 10%
    assert r["stage"] == "conversion"


def test_weak_returns():
    r = diagnose(10000, 600, 90, 45, *RTO)  # 50% returns vs 20%
    assert r["stage"] == "returns"
    assert r["stages"]["returns"]["ratio"] == pytest.approx(0.4)


def test_healthy_and_zero_returns():
    r = diagnose(10000, 600, 90, 0, *RTO)
    assert r["stage"] == "healthy"
    assert r["stages"]["returns"]["ratio"] is None  # no returns = perfect


def test_stages_skipped_without_data():
    r = diagnose(500, 0, 0, 0, *RTO)
    assert set(r["stages"]) == {"interest"} and r["stage"] == "interest"


@pytest.mark.parametrize(("args", "msg"), [
    ((0, 0, 0, 0), "viewed"), ((10, 20, 0, 0), "can't be more than views"), ((100, 10, 2, 3), "Returns"),
])
def test_impossible_numbers(args, msg):
    with pytest.raises(FunnelError, match=msg):
        diagnose(*args, *RTO)


ADVICE_ML = {"explanation": "നിങ്ങളുടെ വീഡിയോ കാണുന്നവർ മെസ്സേജ് അയക്കുന്നില്ല.",
             "fixes": ["ആദ്യ രണ്ട് സെക്കൻഡിൽ പ്രശ്നം കാണിക്കൂ.", "വില വീഡിയോയിൽ കാണിക്കൂ.", "കമന്റിൽ DM ചെയ്യാൻ പറയൂ."],
             "hooks": ["ഇത് കണ്ടിട്ടുണ്ടോ?", "ഇനി ഇത് വേണ്ട!", "ഒരു മിനിറ്റിൽ പരിഹാരം"],
             "message": "ഹായ്! നിങ്ങളുടെ ഓർഡർ ₹499.\nഉറപ്പാക്കാൻ YES എന്ന് മറുപടി അയക്കൂ."}


def test_advice_requires_native_script_and_retries(monkeypatch):
    replies = [ADVICE_ML | {"hooks": ["Seen this?", "No more!", "Fixed in a minute"]}, ADVICE_ML]
    prompts = []
    monkeypatch.setattr(doctor, "complete_json", lambda s, u, temperature, usage: (prompts.append(u), replies.pop(0))[1])
    result = diagnose(10000, 100, 20, 2, *RTO)
    advice = doctor.write_advice(result, {"views": 10000, "clicks": 100, "orders": 20, "returns": 2},
                                 {"name": "Ice Roller", "category": "beauty"}, "ml", 49900)
    assert advice.hooks == ADVICE_ML["hooks"]
    assert "rejected" in prompts[1]


def test_advice_needs_exactly_three():
    with pytest.raises(ValueError):
        DoctorAdvice.model_validate(ADVICE_ML | {"fixes": ADVICE_ML["fixes"][:2]}, context={"language": "ml"})


def test_advice_message_must_be_in_native_script():
    with pytest.raises(ValueError, match="Malayalam"):
        DoctorAdvice.model_validate(ADVICE_ML | {"message": "Hi! Reply YES to confirm your order."}, context={"language": "ml"})


def test_money_counts_delivered_and_returned_orders():
    m = money_result(orders=10, returns=2, price_paise=49900, supplier_paise=15000, shipping_paise=5310, ad_spend_paise=20000)
    assert m["delivered"] == 8 and m["sales_paise"] == 8 * 49900
    assert m["shipping_paise"] == (8 + 4) * 5310 and m["returns_cost_paise"] == 4 * 5310
    assert m["profit_paise"] == (m["sales_paise"] - m["product_cost_paise"] - m["shipping_paise"]
                                 - m["cod_fees_paise"] - 20000)
    assert m["per_delivered_paise"] == 49900 - 15000 - 5310 - 4366


def test_money_with_no_orders_is_just_ad_spend():
    m = money_result(0, 0, 49900, 15000, 5310, 30000)
    assert m["profit_paise"] == -30000 and m["delivered"] == 0
