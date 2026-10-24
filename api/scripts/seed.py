"""Load data/products.csv and the category assumptions into Supabase.

Run from api/:  uv run python scripts/seed.py

data/products.csv is the source of truth: products not in it are deleted from the database.
Safe to re-run: rows are upserted. A blank `id` gets a stable id derived from the product name,
so editing a row and re-running updates it instead of duplicating it. Renaming a product creates a new row.

Columns:
- supplier_price_paise: real supplier quote INCLUDING GST (sellers below the GST threshold can't claim it back)
- shipping_paise: courier freight for the product's weight slab, including GST (≤500 g: core.profit.shipping_paise())
- selling_price_paise + selling_price_source: a real retail price and where it came from (web research or
  scripts/enrich.py via SerpApi). Products without a price are hidden from sellers.
- trend_score, competition_score, image_urls, market_data_updated_at: filled by scripts/enrich.py from SerpApi.
  Leave blank until then (shown as "not checked yet"); never type guesses here.
- supplier_reliability: IndiaMART seller rating out of 5, × 20
- fees_paise is not in the CSV: it's computed from the courier COD rate card.
- source_url, source_notes: where each number came from (not loaded into the database)
"""

import csv
import sys
import uuid
from pathlib import Path

from core.profit import cod_fee_paise
from core.supabase import service_delete_except, service_upsert

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "products.csv"
NAMESPACE = uuid.UUID("6f1c2a52-6c55-4a43-9d0e-7d3f0c2b8e11")
CATEGORIES = {"home_gadgets", "beauty", "phone_accessories", "fitness"}
REQUIRED_INT_COLUMNS = ["supplier_price_paise", "shipping_paise", "supplier_reliability"]
MARKET_INT_COLUMNS = ["selling_price_paise", "trend_score", "competition_score"]  # blank until enrich.py runs

# Estimates shown to sellers, labeled "estimate" and editable. Every number has a source.
# RTO: published COD RTO ranges are indicative industry figures, not audited studies.
# Ads: default assumes organic Reels (what this app makes); paid Instagram ads cost far more per sale.
AD_SOURCE = (
    "Ads: ₹0 assumes organic Reels with no paid ads. Paid Instagram ads cost ₹450–1,400 per sale "
    "(upGrowth, Instagram Ads Pricing India 2026). Enter your own if you boost posts."
)
CATEGORY_ASSUMPTIONS = [
    {"category": "home_gadgets", "rto_rate": 0.22, "ad_cost_per_order_paise": 0,
     "source": "RTO: average COD RTO in India is 20–25% (GoKwik 2026, via base.com); "
               "no home-gadget-specific figure was found. " + AD_SOURCE},
    {"category": "beauty", "rto_rate": 0.17, "ad_cost_per_order_paise": 0,
     "source": "RTO: beauty & personal care COD RTO 12–22%, midpoint (Lokally, Dec 2025, indicative). " + AD_SOURCE},
    {"category": "phone_accessories", "rto_rate": 0.20, "ad_cost_per_order_paise": 0,
     "source": "RTO: electronics & mobile accessories COD RTO 15–25%, midpoint (Lokally, Dec 2025, indicative). " + AD_SOURCE},
    {"category": "fitness", "rto_rate": 0.24, "ad_cost_per_order_paise": 0,
     "source": "RTO: fitness & sporting goods COD RTO 18–30%, midpoint (Lokally, Dec 2025, indicative). " + AD_SOURCE},
]


def _int(raw: dict, col: str, line_no: int, errors: list[str], required: bool) -> int | None:
    value = (raw.get(col) or "").strip()
    if not value:
        if required:
            errors.append(f"line {line_no}: {col} is empty")
        return None
    try:
        return int(value)
    except ValueError:
        errors.append(f"line {line_no}: {col} must be a whole number (paise or 0-100 score), got '{value}'")
        return None


def load_products() -> list[dict]:
    rows, errors = [], []
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        for line_no, raw in enumerate(csv.DictReader(f), start=2):
            name = (raw.get("name") or "").strip()
            if not name:
                errors.append(f"line {line_no}: name is empty")
                continue
            if raw["category"] not in CATEGORIES:
                errors.append(f"line {line_no}: category '{raw['category']}' must be one of {sorted(CATEGORIES)}")
                continue
            if (raw.get("selling_price_paise") or "").strip() and not (raw.get("selling_price_source") or "").strip():
                errors.append(f"line {line_no}: selling_price_source is empty; say where the price came from")
            if not (raw.get("source_url") or "").strip():
                errors.append(f"line {line_no}: source_url is empty; every product needs a real supplier source")
            row = {
                "id": raw["id"].strip() or str(uuid.uuid5(NAMESPACE, name.lower())),
                "name": name,
                "category": raw["category"],
                "image_urls": [u.strip() for u in raw["image_urls"].split("|") if u.strip()],
                "supplier": raw["supplier"].strip() or None,
                "search_keyword": (raw.get("search_keyword") or "").strip() or None,
                "selling_price_source": (raw.get("selling_price_source") or "").strip() or None,
                "market_data_updated_at": (raw.get("market_data_updated_at") or "").strip() or None,
            }
            for col in REQUIRED_INT_COLUMNS:
                row[col] = _int(raw, col, line_no, errors, required=True)
            for col in MARKET_INT_COLUMNS:
                row[col] = _int(raw, col, line_no, errors, required=False)
            price = row["selling_price_paise"]
            row["fees_paise"] = cod_fee_paise(price) if price is not None else None
            rows.append(row)
    if errors:
        sys.exit("Fix data/products.csv:\n  " + "\n  ".join(errors))
    return rows


def main() -> None:
    products = load_products()
    try:
        service_upsert("category_assumptions", CATEGORY_ASSUMPTIONS, on_conflict="category")
        service_upsert("products", products, on_conflict="id")
        # Only the curated catalog: products sellers added themselves (owner_id set) are theirs to keep.
        removed = service_delete_except("products", [p["id"] for p in products], where={"owner_id": "is.null"})
    except RuntimeError as e:
        sys.exit(str(e))
    priced = sum(1 for p in products if p["selling_price_paise"] is not None)
    scored = sum(1 for p in products if p["trend_score"] is not None and p["competition_score"] is not None)
    print(f"Seeded {len(CATEGORY_ASSUMPTIONS)} category assumptions and {len(products)} products: "
          f"{priced} with a real price (shown to sellers), {scored} with trend + competition (scored). "
          f"Removed {removed} products not in the CSV.")
    if scored < len(products):
        print("Run scripts/enrich.py (needs SERPAPI_API_KEY) to add trend and competition.")


if __name__ == "__main__":
    main()
