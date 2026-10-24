"""Fill data/products.csv with real market data, then load it into Supabase.

Run from api/:
  uv run python scripts/enrich.py                  # products not refreshed in the last 7 days
  uv run python scripts/enrich.py --only charger   # one product (name contains "charger")
  uv run python scripts/enrich.py --limit 5 --dry-run

Each product costs 2–3 SerpApi searches (free plan: 250/month).
search_keyword: the specific product phrase (Google Shopping price + sellers).
trend_keyword (optional): what buyers actually type into Google (Google Trends); defaults to search_keyword.
Updates selling_price_paise (market median), trend_score, competition_score, and
image_urls when empty. Supplier price and shipping come from real supplier quotes in the CSV;
fees are computed by seed.py from the courier COD rate card.
"""

import argparse
import csv
import sys
from datetime import UTC, datetime, timedelta

import seed
from core.market_data import COMPARABLE_MAX_MARKUP, fetch_market_snapshot

FRESH_FOR = timedelta(days=7)


def is_fresh(row: dict) -> bool:
    if not row.get("market_data_updated_at"):
        return False
    return datetime.now(UTC) - datetime.fromisoformat(row["market_data_updated_at"]) < FRESH_FOR


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", help="only products whose name contains this text")
    parser.add_argument("--limit", type=int, help="max products to fetch this run")
    parser.add_argument("--force", action="store_true", help="refetch even if updated in the last 7 days")
    parser.add_argument("--dry-run", action="store_true", help="show changes without saving or seeding")
    args = parser.parse_args()

    with seed.CSV_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields, rows = reader.fieldnames, list(reader)

    todo = [
        r for r in rows
        if r.get("search_keyword", "").strip()
        and (not args.only or args.only.lower() in r["name"].lower())
        and (args.force or not is_fresh(r))
    ][: args.limit]
    if not todo:
        sys.exit("Nothing to update. Every product was refreshed in the last 7 days (use --force to refetch).")
    print(f"Fetching market data for {len(todo)} products (2–3 SerpApi searches each)...\n")

    failures = 0
    for row in todo:
        try:
            cost = int(row["supplier_price_paise"])
            snap = fetch_market_snapshot(row["search_keyword"], (row.get("trend_keyword") or "").strip() or None,
                                         ceiling_paise=cost * COMPARABLE_MAX_MARKUP)
        except RuntimeError as e:
            if "SERPAPI_API_KEY" in str(e):
                sys.exit(str(e))
            print(f"  ✗ {row['name']}: {e}")
            failures += 1
            continue

        old = row["selling_price_paise"].strip()
        if snap.market_price_paise is not None:
            row["selling_price_paise"] = str(snap.market_price_paise)
            row["selling_price_source"] = (
                f"Median of comparable listings (≤{COMPARABLE_MAX_MARKUP}× wholesale cost) among {snap.listings} "
                f"Google Shopping India listings — {snap.fetched_at:%Y-%m-%d}"
            )
        # else: too few listings to trust a new price; keep the existing researched price (if any).
        row["trend_score"] = str(snap.trend_score)
        row["competition_score"] = str(snap.competition_score)
        if not row["image_urls"].strip() and snap.image_url:
            row["image_urls"] = snap.image_url
        row["market_data_updated_at"] = snap.fetched_at.isoformat(timespec="seconds")

        price = (
            f"₹{int(old) // 100 if old else '—'} → ₹{snap.market_price_paise // 100}"
            if snap.market_price_paise is not None
            else f"unchanged (only {snap.listings} listings)"
        )
        print(f"  ✓ {row['name']}: price {price}, trend {snap.trend_score} ({snap.trend_region}), "
              f"competition {snap.competition_score} ({snap.sellers} sellers)")

    if args.dry_run:
        print("\nDry run: nothing saved.")
        return

    with seed.CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nSaved {seed.CSV_PATH.name}. Loading into Supabase...")
    seed.main()
    if failures:
        sys.exit(f"{failures} product(s) failed; re-run to retry them.")


if __name__ == "__main__":
    main()
