export const CATEGORIES = [
  { value: "home_gadgets", label: "Home gadgets" },
  { value: "beauty", label: "Beauty" },
  { value: "phone_accessories", label: "Phone accessories" },
  { value: "fitness", label: "Fitness" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

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
  score: number;
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
  market_data_updated_at: string;
  score: number;
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

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 8768 → "₹87.68", 44900 → "₹449", -2860 → "-₹28.60" */
export function formatRupees(paise: number): string {
  return inr.format(paise / 100);
}

/** "2026-10-24T09:12:00+00:00" → "24 Oct 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? c;
