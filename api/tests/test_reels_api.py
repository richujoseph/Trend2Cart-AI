import pytest

PRODUCT_ID = "11111111-1111-1111-1111-111111111111"
REEL_ID = "99999999-9999-9999-9999-999999999999"


@pytest.fixture
def fake(monkeypatch):
    from app import reels

    state = {"plan": "free", "quota": {"allowed": True, "used": 1, "limit": 3, "resets_at": "2026-10-31T18:30:00+00:00"},
             "inserted": [], "rpc": [], "reels": []}

    def rest_get(path, token, params=None):
        if path == "products":
            return [{"id": PRODUCT_ID}] if params["id"] == f"eq.{PRODUCT_ID}" else []
        if path == "profiles":
            return [{"plan": state["plan"]}]
        if path == "reels":
            return [r for r in state["reels"] if params["id"] == f"eq.{r['id']}"]
        raise AssertionError(path)

    def service_rpc(fn, args=None):
        state["rpc"].append((fn, args))
        return state["quota"] if fn == "use_reel_quota" else None

    def service_insert(table, row):
        state["inserted"].append(row)
        return row | {"id": REEL_ID}

    monkeypatch.setattr(reels, "rest_get", rest_get)
    monkeypatch.setattr(reels, "service_rpc", service_rpc)
    monkeypatch.setattr(reels, "service_insert", service_insert)
    return state


BODY = {"product_id": PRODUCT_ID, "audience": "  college girls   in Kochi ", "language": "ml", "template_id": 2}


def test_create_reel_queues_job(client, auth_headers, fake):
    r = client.post("/reels", headers=auth_headers, json=BODY)
    assert r.status_code == 201
    assert r.json() == {"id": REEL_ID, "status": "queued", "reels_left_this_month": 2}
    assert fake["inserted"][0] == {"user_id": "u1", "product_id": PRODUCT_ID, "audience": "college girls in Kochi",
                                   "language": "ml", "template_id": 2, "status": "queued"}
    assert fake["rpc"] == [("use_reel_quota", {"p_user": "u1", "p_limit": 3})]


def test_free_plan_limit_blocks_with_reset_date(client, auth_headers, fake):
    fake["quota"] = {"allowed": False, "used": 3, "limit": 3, "resets_at": "2026-10-31T18:30:00+00:00"}
    r = client.post("/reels", headers=auth_headers, json=BODY)
    assert r.status_code == 429
    assert r.json()["detail"] == "You've used all 3 free Reels this month. You'll get 3 more on 1 Nov."
    assert fake["inserted"] == []


def test_paid_plans_are_unlimited(client, auth_headers, fake):
    fake["plan"] = "founding"
    r = client.post("/reels", headers=auth_headers, json=BODY)
    assert r.json()["reels_left_this_month"] is None
    assert fake["rpc"][0][1]["p_limit"] is None


def test_unknown_product(client, auth_headers, fake):
    r = client.post("/reels", headers=auth_headers, json=BODY | {"product_id": "22222222-2222-2222-2222-222222222222"})
    assert r.status_code == 404 and fake["rpc"] == []


@pytest.mark.parametrize(("field", "value", "message"), [
    ("audience", "x", "Describe who the Reel is for"),
    ("language", "ta", "Malayalam, Hindi or English"),
    ("template_id", 4, "3 Reel styles"),
])
def test_validation_messages(client, auth_headers, fake, field, value, message):
    r = client.post("/reels", headers=auth_headers, json=BODY | {field: value})
    assert r.status_code == 422 and message in r.json()["detail"]


def test_get_reel_status(client, auth_headers, fake):
    fake["reels"].append({"id": REEL_ID, "status": "processing"})
    assert client.get(f"/reels/{REEL_ID}", headers=auth_headers).json()["status"] == "processing"
    assert client.get("/reels/33333333-3333-3333-3333-333333333333", headers=auth_headers).status_code == 404
