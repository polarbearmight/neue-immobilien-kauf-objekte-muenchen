export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

export type Listing = {
  id?: number;
  source: string;
  source_listing_id: string;
  url: string;
  title?: string;
  district?: string;
  area_sqm?: number;
  rooms?: number;
  price_eur?: number;
  price_per_sqm?: number;
  deal_score?: number;
  badges?: string;
  first_seen_at: string;
};

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const getListings = (params = "") => apiFetch<Listing[]>(`/api/listings${params ? `?${params}` : ""}`);
export const getStats = (days = 7) => apiFetch<{ new_listings: number; avg_price_per_sqm: number | null; top_deals?: number }>(`/api/stats?days=${days}`);
export const getSources = () => apiFetch<Array<{ name: string; health_status: string; reliability_score?: number }>>(`/api/sources`);
export const getClusters = () => apiFetch<Array<{ cluster_id: string; members_count: number; members: Listing[] }>>(`/api/clusters`);
export const getPriceDrops = () => apiFetch<Listing[]>(`/api/price-drops`);
