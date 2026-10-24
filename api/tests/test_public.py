from app.public import catalog_stats

P = {"supplier_price_paise": 15000, "shipping_paise": 5310, "fees_paise": 4366, "trend_score": 50,
     "competition_score": 50, "supplier_reliability": 80, "image_urls": ["https://img/a.jpg"]}
A = [{"category": "beauty", "rto_rate": "0.17", "ad_cost_per_order_paise": 0}]


def test_catalog_stats_counts_real_profit():
    products = [P | {"name": "Winner", "category": "beauty", "selling_price_paise": 49900},
                P | {"name": "Trap", "category": "beauty", "selling_price_paise": 16000, "image_urls": []}]
    s = catalog_stats(products, A)
    assert s["products"] == 2 and s["profitable"] == 1 and s["loss_traps"] == 1
    assert [x["name"] for x in s["showcase"]] == ["Winner"] and s["best_profit_paise"] > 0
    assert s["shipping_paise"] == 5310 and s["cod_min_paise"] == 4366


def test_stats_endpoint_is_public(client, monkeypatch):
    from app import public

    monkeypatch.setattr(public, "_cache", (0.0, None))
    monkeypatch.setattr(public, "service_get", lambda t, p: A if t == "category_assumptions" else
                        [P | {"name": "Winner", "category": "beauty", "selling_price_paise": 49900}])
    r = client.get("/public/stats")
    assert r.status_code == 200 and r.json()["products"] == 1
