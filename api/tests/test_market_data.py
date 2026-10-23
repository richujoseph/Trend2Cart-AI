import pytest

from core import market_data
from core.market_data import competition_score, market_price_paise, trend_score


def test_market_price_is_median_in_whole_rupees():
    # median ₹449.50 rounds half-up to ₹450
    assert market_price_paise([399, 449, 449.5, 499, 549]) == 45000


def test_market_price_rounds_to_rupee():
    assert market_price_paise([300, 349.6, 400]) == 35000


def test_market_price_drops_bundles_and_accessories():
    # ₹49 cable and ₹2999 bundle would skew the price; the typical price is ₹449
    assert market_price_paise([49, 399, 449, 499, 2999]) == 44900


def test_market_price_needs_enough_listings():
    assert market_price_paise([449, 0, None]) is None


@pytest.mark.parametrize(
    ("sellers", "expected"),
    [
        ([], 0),
        (["Meesho", "meesho ", "Amazon.in"], 10),  # 2 distinct sellers
        ([f"shop{i}" for i in range(10)], 50),
        ([f"shop{i}" for i in range(40)], 100),  # capped
    ],
)
def test_competition_score(sellers, expected):
    assert competition_score(sellers) == expected


def test_trend_flat_interest_is_50():
    assert trend_score([[50] * 10, [50] * 10]) == 50


def test_trend_rising_interest_is_high():
    # earlier avg 40, recent avg 80 → +100% momentum → capped at 100
    assert trend_score([[40] * 7 + [80] * 3]) == 100


def test_trend_falling_interest_is_low():
    # earlier 80, recent 40 → -50% → 0
    assert trend_score([[80] * 7 + [40] * 3]) == 0


def test_trend_sparse_searches_score_low():
    # earlier avg 10, recent avg 10 → flat (50), but only 5 of 10 days have searches → 25
    assert trend_score([[0, 0, 0, 0, 20, 20, 30, 0, 15, 15]]) == 25


def test_trend_no_searches_is_zero():
    assert trend_score([[0] * 10, []]) == 0


def test_fetch_market_snapshot_parses_serpapi(monkeypatch):
    def fake_serpapi(params):
        if params["engine"] == "google_shopping":
            return {"shopping_results": [
                {"extracted_price": 399.0, "source": "Meesho", "thumbnail": "https://img/1.jpg"},
                {"extracted_price": 449.0, "source": "Amazon.in"},
                {"extracted_price": 499.0, "source": "Flipkart"},
            ]}
        assert params["geo"] == "IN-KL,IN-TN"
        return {"interest_over_time": {"timeline_data": [
            {"values": [{"query_index": 0, "extracted_value": 50}, {"query_index": 1, "extracted_value": 50}]}
            for _ in range(10)
        ]}}

    monkeypatch.setattr(market_data, "_serpapi", fake_serpapi)
    snap = market_data.fetch_market_snapshot("lint remover")
    assert snap.market_price_paise == 44900
    assert snap.sellers == 3
    assert snap.competition_score == 15
    assert snap.trend_score == 50
    assert snap.image_url == "https://img/1.jpg"


def _shopping():
    return {"shopping_results": [{"extracted_price": p, "source": f"s{p}"} for p in (399, 449, 499)]}


def test_trends_falls_back_to_india_when_states_have_no_data(monkeypatch):
    geos = []

    def fake(params):
        if params["engine"] == "google_shopping":
            return _shopping()
        geos.append(params["geo"])
        if params["geo"] == "IN-KL,IN-TN":
            raise RuntimeError("SerpApi error (200): Google Trends hasn't returned any results for this query.")
        return {"interest_over_time": {"timeline_data": [{"values": [{"query_index": 0, "extracted_value": 40}]}] * 10}}

    monkeypatch.setattr(market_data, "_serpapi", fake)
    snap = market_data.fetch_market_snapshot("lint remover")
    assert geos == ["IN-KL,IN-TN", "IN"] and snap.trend_region == "India" and snap.trend_score == 50


def test_no_trends_data_anywhere_means_trend_zero(monkeypatch):
    def fake(params):
        if params["engine"] == "google_shopping":
            return _shopping()
        raise RuntimeError("SerpApi error (200): Google Trends hasn't returned any results for this query.")

    monkeypatch.setattr(market_data, "_serpapi", fake)
    snap = market_data.fetch_market_snapshot("very niche thing")
    assert snap.trend_score == 0 and snap.trend_region == "none" and snap.market_price_paise == 44900


def test_other_serpapi_errors_still_fail(monkeypatch):
    def fake(params):
        if params["engine"] == "google_shopping":
            return _shopping()
        raise RuntimeError("SerpApi error (401): Invalid API key")

    monkeypatch.setattr(market_data, "_serpapi", fake)
    with pytest.raises(RuntimeError, match="Invalid API key"):
        market_data.fetch_market_snapshot("x")


def test_sparse_state_data_falls_back_to_india_and_uses_trend_keyword(monkeypatch):
    calls = []
    one_spike = [{"values": [{"query_index": 0, "extracted_value": 100 if i == 5 else 0},
                             {"query_index": 1, "extracted_value": 0}]} for i in range(90)]
    steady = [{"values": [{"query_index": 0, "extracted_value": 50}]} for _ in range(90)]

    def fake(params):
        if params["engine"] == "google_shopping":
            assert params["q"] == "pull string vegetable chopper"
            return _shopping()
        calls.append((params["q"], params["geo"]))
        return {"interest_over_time": {"timeline_data": one_spike if params["geo"] == "IN-KL,IN-TN" else steady}}

    monkeypatch.setattr(market_data, "_serpapi", fake)
    snap = market_data.fetch_market_snapshot("pull string vegetable chopper", "vegetable chopper")
    assert calls == [("vegetable chopper,vegetable chopper", "IN-KL,IN-TN"), ("vegetable chopper", "IN")]
    assert snap.trend_region == "India" and snap.trend_score == 50
