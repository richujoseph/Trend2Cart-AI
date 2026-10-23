import hashlib
import hmac

import pytest

from core.doctor import DoctorAdvice

PRODUCT = {"id": "11111111-1111-1111-1111-111111111111", "name": "Ice Roller", "category": "beauty"}
REEL_ID = "99999999-9999-9999-9999-999999999999"


@pytest.fixture
def doctor_fakes(monkeypatch):
    from app import doctor

    inserted = []

    def rest_get(path, token, params=None):
        return {
            "reels": [{"product_id": PRODUCT["id"], "language": "ml"}] if params.get("id") == f"eq.{REEL_ID}" else [],
            "products": [PRODUCT],
            "profiles": [{"language": "en"}],
            "category_assumptions": [{"rto_rate": 0.17, "source": "x"}],
        }[path]

    def service_insert(table, row):
        inserted.append((table, row))
        return row | {"id": "res-1"}

    monkeypatch.setattr(doctor, "rest_get", rest_get)
    monkeypatch.setattr(doctor, "service_insert", service_insert)
    monkeypatch.setattr(doctor, "write_advice", lambda result, numbers, product, language: DoctorAdvice(
        explanation="Explain this simply.", fixes=["Fix one", "Fix two", "Fix three"], hooks=["Hook a", "Hook b", "Hook c"]))
    return inserted


NUMBERS = {"views": 10000, "clicks": 100, "orders": 20, "returns": 2}


def test_doctor_for_app_reel(client, auth_headers, doctor_fakes):
    r = client.post("/doctor", headers=auth_headers, json={"reel_id": REEL_ID} | NUMBERS)
    body = r.json()
    assert r.status_code == 201 and body["stage"] == "interest" and body["language"] == "ml"
    assert body["stages"]["returns"]["benchmark"] == 0.17
    tables = [t for t, _ in doctor_fakes]
    assert tables == ["campaign_results", "diagnoses"]
    assert doctor_fakes[0][1]["product_id"] == PRODUCT["id"] and doctor_fakes[0][1]["user_id"] == "u1"
    assert doctor_fakes[1][1]["new_hooks"] == ["Hook a", "Hook b", "Hook c"]


def test_doctor_needs_reel_or_product(client, auth_headers, doctor_fakes):
    r = client.post("/doctor", headers=auth_headers, json=NUMBERS)
    assert r.status_code == 422 and "Pick the Reel" in r.json()["detail"]


def test_doctor_rejects_impossible_numbers(client, auth_headers, doctor_fakes):
    r = client.post("/doctor", headers=auth_headers, json={"product_id": PRODUCT["id"]} | NUMBERS | {"clicks": 20000})
    assert r.status_code == 422 and "can't be more than views" in r.json()["detail"]
    assert doctor_fakes == []


@pytest.fixture
def pay(monkeypatch):
    from app import preorders

    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_abc")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret123")
    from core.config import get_settings

    get_settings.cache_clear()
    state = {"plan": "free", "rows": [], "updates": []}
    monkeypatch.setattr(preorders, "rest_get", lambda *a, **k: [{"plan": state["plan"]}])
    monkeypatch.setattr(preorders.razorpay, "create_order", lambda amount, receipt, notes: {"id": "order_123", "amount": amount})
    monkeypatch.setattr(preorders, "service_insert", lambda t, row: state["rows"].append(row) or row)
    monkeypatch.setattr(preorders, "service_get", lambda t, p: [{"id": "p1", "user_id": "u1", "status": "created"}]
                        if p["razorpay_order_id"] == "eq.order_123" else [])
    monkeypatch.setattr(preorders, "service_update", lambda t, rid, f: state["updates"].append((t, rid, f)))
    return state


def sign(order, payment, secret="secret123"):
    return hmac.new(secret.encode(), f"{order}|{payment}".encode(), hashlib.sha256).hexdigest()


def test_preorder_create(client, auth_headers, pay):
    r = client.post("/preorders", headers=auth_headers)
    assert r.status_code == 201
    assert r.json()["order_id"] == "order_123" and r.json()["amount_paise"] == 9900 and r.json()["key_id"] == "rzp_test_abc"
    assert pay["rows"][0] == {"user_id": "u1", "amount_paise": 9900, "status": "created", "razorpay_order_id": "order_123"}


def test_preorder_rejects_existing_founding_member(client, auth_headers, pay):
    pay["plan"] = "founding"
    assert client.post("/preorders", headers=auth_headers).status_code == 409


def test_verify_good_signature_upgrades_plan(client, auth_headers, pay):
    body = {"razorpay_order_id": "order_123", "razorpay_payment_id": "pay_456", "razorpay_signature": sign("order_123", "pay_456")}
    r = client.post("/preorders/verify", headers=auth_headers, json=body)
    assert r.status_code == 200 and r.json() == {"plan": "founding"}
    assert ("profiles", "u1", {"plan": "founding"}) in pay["updates"]


def test_verify_rejects_forged_signature(client, auth_headers, pay):
    body = {"razorpay_order_id": "order_123", "razorpay_payment_id": "pay_456",
            "razorpay_signature": sign("order_123", "pay_456", "wrong-secret")}
    r = client.post("/preorders/verify", headers=auth_headers, json=body)
    assert r.status_code == 400 and pay["updates"] == []


def test_verify_rejects_someone_elses_order(client, auth_headers, pay):
    body = {"razorpay_order_id": "order_999", "razorpay_payment_id": "pay_456", "razorpay_signature": sign("order_999", "pay_456")}
    assert client.post("/preorders/verify", headers=auth_headers, json=body).status_code == 404


def test_payments_off_without_keys(client, auth_headers, monkeypatch):
    monkeypatch.setenv("RAZORPAY_KEY_ID", "")
    from core.config import get_settings

    get_settings.cache_clear()
    r = client.post("/preorders", headers=auth_headers)
    assert r.status_code == 503 and "aren't switched on" in r.json()["detail"]
