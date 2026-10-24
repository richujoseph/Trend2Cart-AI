from datetime import datetime, timedelta, timezone

import pytest

from core import discover
from core.discover import build_lookup, momentum_pct, normalize_query, price_range_paise, rank_trending, weekly


@pytest.mark.parametrize(("raw", "expected"), [
    ("  Neck   FAN!! ", "neck fan"),
    ("type-c charger 20W", "type-c charger 20w"),
    ("ab", None),
    ("1234", None),
    ("<script>", "script"),
])
def test_normalize_query(raw, expected):
    assert normalize_query(raw) == expected


def test_momentum_rising_and_falling():
    assert momentum_pct([40] * 7 + [60] * 3) == 50
    assert momentum_pct([80] * 7 + [40] * 3) == -50


def test_momentum_needs_enough_searches():
    assert momentum_pct([0] * 9 + [100]) is None  # one spike in 10 days is noise
    assert momentum_pct([5] * 5) is None  # too short


def test_price_range_is_middle_half():
    assert price_range_paise([100, 200, 300, 400, 500, 600, 700, 800]) == (30000, 60000)
    assert price_range_paise([199, 299]) is None


def test_weekly_averages_regions_then_weeks():
    assert weekly([[10] * 14, [30] * 14]) == [20, 20]
    assert weekly([]) == []


def test_rank_trending_prefers_steady_rise_and_skips_sparse():
    ranked = rank_trending({
        "lint remover": [0, 0, 5, 0, 0, 0, 0, 20, 30, 20],  # big % jump from almost nothing
        "neck fan": [40] * 7 + [80] * 3,
        "ice roller": [50] * 10,
        "nail art": [0] * 10,
    })
    assert [i["term"] for i in ranked] == ["neck fan", "ice roller", "lint remover"]
    assert ranked[0]["change_pct"] == 100 and ranked[0]["category"] == "home_gadgets"


def test_build_lookup():
    shopping = [{"title": f"Fan {p}", "extracted_price": p, "source": f"shop{p % 3}", "thumbnail": "t.jpg",
                 "product_link": "https://g/x"} for p in (299, 349, 399, 449, 499)]
    d = build_lookup("neck fan", shopping, [[40] * 7 + [60] * 3, [40] * 7 + [60] * 3], "Kerala + Tamil Nadu")
    assert d["market_price_paise"] == 39900 and (d["price_low_paise"], d["price_high_paise"]) == (34900, 44900)
    assert d["sellers"] == 3 and d["trend_change_pct"] == 50 and d["image_url"] == "t.jpg"
    assert d["listings"][0] == {"title": "Fan 299", "price_paise": 29900, "source": "shop2", "thumbnail": "t.jpg",
                                "link": "https://g/x", "rating": None, "reviews": None}


@pytest.fixture
def api(monkeypatch):
    from app import discover as route

    state = {"cache": {}, "log": [], "lookups": 0}
    now = datetime.now(timezone.utc)

    def service_get(table, params):
        if table == "market_lookups":
            row = state["cache"].get(params["key"][3:])
            return [row] if row else []
        return [{"id": i} for i in range(len(state["log"]))]

    def lookup(q):
        state["lookups"] += 1
        return {"query": q, "fetched_at": now.isoformat()}

    monkeypatch.setattr(route, "service_get", service_get)
    monkeypatch.setattr(route, "service_upsert", lambda t, rows, on_conflict: state["cache"].update(
        {r["key"]: {"data": r["data"], "fetched_at": r["fetched_at"]} for r in rows}))
    monkeypatch.setattr(route, "service_insert", lambda t, row: state["log"].append(row))
    monkeypatch.setattr(route, "lookup_product", lookup)
    monkeypatch.setattr(route, "searches_left", lambda: state.get("left", 200))
    monkeypatch.setattr(route, "_trending_failed_at", 0.0)
    monkeypatch.setattr(route, "_refreshing", False)
    state["now"] = now
    return state


def test_search_fetches_once_then_serves_cache(client, auth_headers, api):
    r1 = client.get("/discover/search", params={"q": "Neck Fan"}, headers=auth_headers)
    r2 = client.get("/discover/search", params={"q": "neck   fan"}, headers=auth_headers)
    assert r1.json()["cached"] is False and r2.json()["cached"] is True
    assert api["lookups"] == 1 and api["log"] == [{"user_id": "u1", "query": "neck fan"}]


def test_search_refetches_after_a_week(client, auth_headers, api):
    old = (api["now"] - timedelta(days=8)).isoformat()
    api["cache"]["search:neck fan"] = {"data": {"query": "neck fan", "fetched_at": old}, "fetched_at": old}
    assert client.get("/discover/search", params={"q": "neck fan"}, headers=auth_headers).json()["cached"] is False


def test_search_daily_cap(client, auth_headers, api):
    api["log"].extend([{}] * 10)
    r = client.get("/discover/search", params={"q": "neck fan"}, headers=auth_headers)
    assert r.status_code == 429 and "10 new searches" in r.json()["detail"] and api["lookups"] == 0


def test_search_rejects_junk(client, auth_headers, api):
    r = client.get("/discover/search", params={"q": "!!"}, headers=auth_headers)
    assert r.status_code == 422 and "product name" in r.json()["detail"]


def test_search_stops_near_monthly_limit(client, auth_headers, api):
    api["left"] = 10
    r = client.get("/discover/search", params={"q": "neck fan"}, headers=auth_headers)
    assert r.status_code == 503 and "limit for this month" in r.json()["detail"] and api["lookups"] == 0


def test_failed_search_still_counts_toward_daily_limit(client, auth_headers, api, monkeypatch):
    from app import discover as route

    def broke(q):
        raise RuntimeError("SerpApi error (500): boom")

    monkeypatch.setattr(route, "lookup_product", broke)
    client.get("/discover/search", params={"q": "neck fan"}, headers=auth_headers)
    assert api["log"] == [{"user_id": "u1", "query": "neck fan"}]


def test_failed_trending_refresh_waits_an_hour(client, auth_headers, api, monkeypatch):
    from app import discover as route

    calls = []

    def broke():
        calls.append(1)
        raise RuntimeError("SerpApi down")

    monkeypatch.setattr(route, "fetch_trending", broke)
    client.get("/discover/trending", headers=auth_headers)
    r = client.get("/discover/trending", headers=auth_headers)
    assert calls == [1] and r.json()["refreshing"] is False  # no retry storm; the page stops waiting


def test_search_out_of_serpapi_searches(client, auth_headers, api, monkeypatch):
    from app import discover as route

    def broke(q):
        raise RuntimeError("SerpApi error (429): Your account has run out of searches.")

    monkeypatch.setattr(route, "lookup_product", broke)
    r = client.get("/discover/search", params={"q": "neck fan"}, headers=auth_headers)
    assert r.status_code == 503 and "limit for this month" in r.json()["detail"]


def test_trending_empty_starts_refresh(client, auth_headers, api, monkeypatch):
    from app import discover as route

    refreshed = []
    monkeypatch.setattr(route, "fetch_trending", lambda: refreshed.append(1) or
                        {"region": "India", "items": [{"term": "neck fan"}], "fetched_at": api["now"].isoformat()})
    r = client.get("/discover/trending", headers=auth_headers)
    assert r.json() == {"region": "India", "items": [], "fetched_at": None, "refreshing": True}
    assert refreshed == [1]  # background task ran after the response
    r = client.get("/discover/trending", headers=auth_headers)
    assert r.json()["items"] == [{"term": "neck fan"}] and r.json()["refreshing"] is False


def test_estimate_uses_catalog_costs(client, auth_headers):
    r = client.post("/discover/estimate", headers=auth_headers,
                    json={"selling_price_paise": 49900, "supplier_price_paise": 15000})
    body = r.json()
    assert body["shipping_paise"] == 5310 and body["fees_paise"] == 4366
    # (1 − 0.22) × (499 − 150 − 53.10 − 43.66) − 0.22 × 2 × 53.10
    assert body["profit_paise"] == round(0.78 * (49900 - 15000 - 5310 - 4366)) - round(0.22 * 2 * 5310)


def test_update_me_saves_language(client, auth_headers, monkeypatch):
    from app import main

    saved = []
    monkeypatch.setattr(main, "service_update", lambda t, rid, f: saved.append((t, rid, f)))
    r = client.patch("/me", headers=auth_headers, json={"language": "hi", "region": "kerala"})
    assert r.json() == {"language": "hi", "region": "kerala"} and saved == [("profiles", "u1", r.json())]
    assert client.patch("/me", headers=auth_headers, json={"language": "ta"}).status_code == 422


def test_candidates_are_unique():
    terms = [t for t, _ in discover.CANDIDATES]
    assert len(terms) == len(set(terms)) == 30


def test_update_me_saves_details_and_clears_empty(client, auth_headers, monkeypatch):
    from app import main

    saved = []
    monkeypatch.setattr(main, "service_update", lambda t, rid, f: saved.append(f))
    r = client.patch("/me", headers=auth_headers, json={"display_name": "  Anu   Joseph ", "whatsapp": "9876543210", "city": ""})
    assert r.status_code == 200 and saved == [{"display_name": "Anu Joseph", "whatsapp": "9876543210", "city": None}]
    bad = client.patch("/me", headers=auth_headers, json={"whatsapp": "12345"})
    assert bad.status_code == 422
