import type { Category } from "@/lib/products";

export type TrendingItem = { term: string; category: Category | null; change_pct: number; score: number; weekly: number[] };
export type Trending = { region: string; items: TrendingItem[]; fetched_at: string | null; refreshing: boolean };

export type Listing = {
  title: string;
  price_paise: number;
  source: string | null;
  thumbnail: string | null;
  link: string | null;
  rating: number | null;
  reviews: number | null;
};

export type Lookup = {
  query: string;
  market_price_paise: number | null;
  price_low_paise: number | null;
  price_high_paise: number | null;
  listings_count: number;
  sellers: number;
  competition_score: number;
  trend_score: number;
  trend_change_pct: number | null;
  trend_region: "Kerala + Tamil Nadu" | "India" | "none";
  weekly: number[];
  image_url: string | null;
  listings: Listing[];
  fetched_at: string;
  cached: boolean;
};

export type Estimate = {
  profit_paise: number;
  shipping_paise: number;
  fees_paise: number;
  default_rto_rate: number;
  rto_source: string;
};
