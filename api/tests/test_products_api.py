import pytest

CHARGER_ID = "11111111-1111-1111-1111-111111111111"
BANDS_ID = "22222222-2222-2222-2222-222222222222"

PRODUCTS = [
    {"id": CHARGER_ID, "name": "20W Charger", "category": "phone_accessories", "image_urls": [], "supplier": "S", "market_data_updated_at": "2026-10-24T00:00:00+00:00",
     "supplier_price_paise": 21000, "shipping_paise": 5500, "fees_paise": 4200, "selling_price_paise": 39900,
     "trend_score": 50, "competition_score": 90, "supplier_reliability": 55},
    {"id": BANDS_ID, "name": "Resistance Bands", "category": "fitness", "image_urls": [], "supplier": "S", "market_data_updated_at": "2026-10-24T00:00:00+00:00",
     "supplier_price_paise": 16000, "shipping_paise": 6500, "fees_paise": 4800, "selling_price_paise": 49900,
     "trend_score": 62, "competition_score": 70, "supplier_reliability": 72},
    {"id": "44444444-4444-4444-4444-444444444444", "name": "Not enriched yet", "category": "fitness", "image_urls": [], "supplier": "S", "market_data_updated_at": "2026-10-24T00:00:00+00:00",
     "supplier_price_paise": 9440, "shipping_paise": 5310, "fees_paise": 4366, "selling_price_paise": 32900,
     "trend_score": None, "competition_score": None, "supplier_reliability": 94},
]
ASSUMPTIONS = [
    {"category": "phone_accessories", "rto_rate": 0.30, "ad_cost_per_order_paise": 6000, "source": "interview estimate"},
    {"category": "fitness", "rto_rate": 0.22, "ad_cost_per_order_paise": 6000, "source": "interview estimate"},
]


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch):
    def rest_get(path, token, params=None):
        if path == "category_assumptions":
            return ASSUMPTIONS
        rows = PRODUCTS
        if params and "id" in params:
            rows = [p for p in rows if params["id"] == f"eq.{p['id']}"]
        if params and "category" in params:
            rows = [p for p in rows if params["category"] == f"eq.{p['category']}"]
        for col, op in (params or {}).items():
            if op == "not.is.null":
                rows = [p for p in rows if p[col] is not None]
        return rows

    from app import products

    monkeypatch.setattr(products, "rest_get", rest_get)


def test_list_requires_sign_in(client):
    assert client.get("/products").status_code == 401


def test_list_sorted_by_score_with_loss_trap(client, auth_headers):
    items = client.get("/products?sort=score", headers=auth_headers).json()
    assert [i["id"] for i in items][:2] == [BANDS_ID, CHARGER_ID]
    charger = items[1]
    assert charger["profit_paise"] == -2860
    assert charger["profit_paise"] == -2860 and charger["mine"] is False
    assert charger["loss_trap"] is True
    assert charger["estimates"] == {"rto_rate": 0.3, "ad_cost_paise": 6000, "default_rto_rate": 0.3, "default_ad_cost_paise": 6000,
                                    "source": "interview estimate", "edited_by_seller": False}


def test_list_filters_by_category(client, auth_headers):
    items = client.get("/products?category=fitness", headers=auth_headers).json()
    assert [i["id"] for i in items] == [BANDS_ID, "44444444-4444-4444-4444-444444444444"]


def test_list_rejects_unknown_category(client, auth_headers):
    r = client.get("/products?category=cars", headers=auth_headers)
    assert r.status_code == 422
    assert r.json()["detail"] == "Please pick a valid category."


def test_unscored_products_are_listed_last_with_score_pending(client, auth_headers):
    items = client.get("/products", headers=auth_headers).json()
    assert items[-1]["id"] == "44444444-4444-4444-4444-444444444444"
    assert items[-1]["score"] is None
    r = client.post("/products/44444444-4444-4444-4444-444444444444/simulate", headers=auth_headers)
    assert r.status_code == 200 and r.json()["score"] is None


def test_products_without_a_price_are_hidden(client, auth_headers, monkeypatch):
    from app import products

    PRODUCTS.append({**PRODUCTS[0], "id": "55555555-5555-5555-5555-555555555555",
                     "selling_price_paise": None, "fees_paise": None})
    try:
        ids = [i["id"] for i in client.get("/products", headers=auth_headers).json()]
        assert "55555555-5555-5555-5555-555555555555" not in ids
    finally:
        PRODUCTS.pop()


def test_simulate_defaults_match_list(client, auth_headers):
    r = client.post(f"/products/{CHARGER_ID}/simulate", headers=auth_headers)
    body = r.json()
    assert body["profit_paise"] == -2860
    assert sum(v for k, v in body["breakdown"].items() if k != "revenue") == body["breakdown"]["revenue"] + 2860


def test_simulate_overrides_turn_trap_into_profit(client, auth_headers):
    # Prepaid-heavy seller: 5% RTO, ₹30 ads, sells at ₹449
    r = client.post(f"/products/{CHARGER_ID}/simulate", headers=auth_headers,
                    json={"selling_price_paise": 44900, "rto_rate": 0.05, "ad_cost_paise": 3000})
    body = r.json()
    # COD fee is recomputed for the new price: ₹37 minimum + GST = 4366
    # 0.95 * (44900 - 21000 - 5500 - 4366) - 0.05 * 11000 - 3000 = 13332.3 - 550 - 3000
    assert body["profit_paise"] == 9782
    assert body["loss_trap"] is False
    assert body["estimates"]["edited_by_seller"] is True
    assert body["inputs"]["selling_price_paise"] == 44900


def test_simulate_rejects_bad_rto(client, auth_headers):
    r = client.post(f"/products/{CHARGER_ID}/simulate", headers=auth_headers, json={"rto_rate": 1.5})
    assert r.status_code == 422
    assert "between 0% and 100%" in r.json()["detail"]


def test_simulate_unknown_product(client, auth_headers):
    r = client.post("/products/33333333-3333-3333-3333-333333333333/simulate", headers=auth_headers)
    assert r.status_code == 404


def test_sort_by_least_competition(client, auth_headers):
    names = [p["name"] for p in client.get("/products?sort=competition", headers=auth_headers).json()]
    assert names[:2] == ["Resistance Bands", "20W Charger"] and names[-1] == "Not enriched yet"


LOOKUP = {"query": "neck fan", "market_price_paise": 75000, "trend_score": 22, "trend_region": "India",
          "competition_score": 20, "image_url": "https://img/fan.jpg", "fetched_at": "2026-10-24T10:00:00+00:00"}


@pytest.fixture
def own(monkeypatch):
    from app import products

    state = {"lookups": [{"data": LOOKUP}], "owned": [], "inserted": [], "deleted": 1}
    monkeypatch.setattr(products, "service_get", lambda t, p: state["lookups"] if t == "market_lookups" else state["owned"])
    monkeypatch.setattr(products, "service_insert", lambda t, row: state["inserted"].append(row) or {"id": "p-new"})
    monkeypatch.setattr(products, "service_delete", lambda t, f: state["deleted"])
    return state


OWN = {"query": "Neck Fan", "name": "  My   Neck Fan ", "category": "home_gadgets",
       "supplier_price_paise": 18644, "selling_price_paise": 59900, "weight_slabs": 1}


def test_add_own_product_uses_real_search_data(client, auth_headers, own):
    r = client.post("/products/mine", headers=auth_headers, json=OWN)
    row = own["inserted"][0]
    assert r.status_code == 201 and r.json() == {"id": "p-new"}
    assert row["owner_id"] == "u1" and row["name"] == "My Neck Fan" and row["supplier_reliability"] is None
    assert row["trend_score"] == 22 and row["competition_score"] == 20 and row["image_urls"] == ["https://img/fan.jpg"]
    assert row["fees_paise"] == 4366 and row["shipping_paise"] == 5310  # ₹37 COD minimum × 1.18 at ₹599
    assert "market typical ₹750" in row["selling_price_source"]


def test_add_own_product_needs_a_search_first(client, auth_headers, own):
    own["lookups"] = []
    r = client.post("/products/mine", headers=auth_headers, json=OWN)
    assert r.status_code == 404 and "Search for this product first" in r.json()["detail"]


def test_own_product_limit(client, auth_headers, own):
    own["owned"] = [{"id": str(i)} for i in range(20)]
    assert client.post("/products/mine", headers=auth_headers, json=OWN).status_code == 429


def test_remove_own_product(client, auth_headers, own):
    assert client.delete(f"/products/mine/{CHARGER_ID}", headers=auth_headers).status_code == 204
    own["deleted"] = 0
    assert client.delete(f"/products/mine/{CHARGER_ID}", headers=auth_headers).status_code == 404


def test_unrated_supplier_scores_on_other_factors():
    from core.profit import score

    # same inputs; unrated = the rated score without the 10% reliability part, scaled to 100
    assert score(10000, 50000, 60, 40, None) == round((0.5 * (20 / 30 * 100) + 0.25 * 60 + 0.15 * 60) / 0.9)
