"""Load data/products.csv and the default category assumptions into Supabase.

Run from api/:  uv run python scripts/seed.py
Safe to re-run: rows are upserted. A blank `id` gets a stable id derived from the product name,
so editing a row and re-running updates it instead of duplicating it. Renaming a product creates a new row.
image_urls: separate multiple URLs with "|".
"""

import csv
import sys
import uuid
from pathlib import Path

from core.supabase import service_upsert

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "products.csv"
NAMESPACE = uuid.UUID("6f1c2a52-6c55-4a43-9d0e-7d3f0c2b8e11")
CATEGORIES = {"home_gadgets", "beauty", "phone_accessories", "fitness"}
INT_COLUMNS = [
    "supplier_price_paise", "shipping_paise", "fees_paise", "selling_price_paise",
    "trend_score", "competition_score", "supplier_reliability",
]

# Placeholders until we have real numbers. Shown to sellers as editable estimates.
CATEGORY_ASSUMPTIONS = [
    {"category": c, "rto_rate": r, "ad_cost_per_order_paise": 6000, "source": "interview estimate"}
    for c, r in [("home_gadgets", 0.25), ("beauty", 0.20), ("phone_accessories", 0.30), ("fitness", 0.22)]
]


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
            row = {
                "id": raw["id"].strip() or str(uuid.uuid5(NAMESPACE, name.lower())),
                "name": name,
                "category": raw["category"],
                "image_urls": [u.strip() for u in raw["image_urls"].split("|") if u.strip()],
                "supplier": raw["supplier"].strip() or None,
            }
            for col in INT_COLUMNS:
                try:
                    row[col] = int(raw[col])
                except ValueError:
                    errors.append(f"line {line_no}: {col} must be a whole number (paise or 0-100 score), got '{raw[col]}'")
            rows.append(row)
    if errors:
        sys.exit("Fix data/products.csv:\n  " + "\n  ".join(errors))
    return rows


def main() -> None:
    products = load_products()
    try:
        service_upsert("category_assumptions", CATEGORY_ASSUMPTIONS, on_conflict="category")
        service_upsert("products", products, on_conflict="id")
    except RuntimeError as e:
        sys.exit(str(e))
    print(f"Seeded {len(CATEGORY_ASSUMPTIONS)} category assumptions and {len(products)} products.")


if __name__ == "__main__":
    main()
