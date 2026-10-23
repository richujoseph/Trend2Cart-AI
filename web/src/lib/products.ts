// Labels are in the i18n dictionary (t.categories).
export const CATEGORIES = ["home_gadgets", "beauty", "phone_accessories", "fitness"] as const;

export type Category = (typeof CATEGORIES)[number];

export type Estimates = {
  rto_rate: number;
  ad_cost_paise: number;
  default_rto_rate: number;
  default_ad_cost_paise: number;
  source: string | null;
  edited_by_seller: boolean;
};

export type ProductListItem = {
  id: string;
  name: string;
  category: Category;
  image_urls: string[];
  selling_price_paise: number;
  selling_price_source: string | null;
  score: number | null; // null until trend + competition are checked
  profit_paise: number;
  profit_rupees: number;
  loss_trap: boolean;
  estimates: Estimates;
};

export type Simulation = {
  id: string;
  name: string;
  category: Category;
  image_urls: string[];
  supplier: string | null;
  market_data_updated_at: string | null;
  selling_price_source: string | null;
  trend_score: number | null;
  competition_score: number | null;
  score: number | null;
  profit_paise: number;
  loss_trap: boolean;
  breakdown: {
    revenue: number;
    supplier_cost: number;
    shipping: number;
    fees: number;
    rto_shipping_loss: number;
    ad_cost: number;
  };
  inputs: {
    selling_price_paise: number;
    supplier_price_paise: number;
    shipping_paise: number;
    fees_paise: number;
    market_selling_price_paise: number;
  };
  estimates: Estimates;
};

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** 8768 → "₹87.68", 4560 → "₹45.60", 44900 → "₹449", -2860 → "-₹28.60" */
export function formatRupees(paise: number): string {
  return (paise % 100 === 0 ? inrWhole : inrPaise).format(paise / 100);
}
