// Browser: prefer same-origin so SSH-forwarded or reverse-proxied frontends keep working.
// Server-side rendering: relative URLs are invalid, so fall back to a concrete backend origin.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const SERVER_API_URL = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:7001";

export type Listing = {
  id?: number;
  source: string;
  source_listing_id: string;
  url: string;
  title?: string;
  display_title?: string;
  raw_title?: string;
  description?: string;
  raw_description?: string;
  district?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  location_confidence?: number;
  district_source?: string;
  area_sqm?: number;
  rooms?: number;
  price_eur?: number;
  price_per_sqm?: number;
  deal_score?: number;
  estimated_rent_per_sqm?: number;
  estimated_monthly_rent?: number;
  gross_yield_percent?: number;
  price_to_rent_ratio?: number;
  investment_score?: number;
  investment_explain?: string;
  off_market_score?: number;
  off_market_flags?: string;
  off_market_explain?: string;
  exclusivity_score?: number;
  source_popularity_score?: number;
  badges?: string;
  score_explain?: string;
  ai_flags?: string;
  cluster_id?: string;
  posted_at?: string;
  first_seen_at: string;
};

function getAuthUsername(): string {
  if (typeof document === "undefined") return "";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith("mdf_auth_client="));
  if (!cookie) return "";
  const token = decodeURIComponent(cookie.split("=")[1] ?? "");
  const idx = token.lastIndexOf(".");
  if (idx === -1) return "";
  const payload = token.slice(0, idx);
  return payload.split(":")[0] ?? "";
}

async function apiFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const baseUrl = typeof window === "undefined" ? SERVER_API_URL : API_URL;
  const headers: Record<string, string> = {};
  const username = getAuthUsername();
  if (username) headers["X-MDF-Username"] = username;
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store", signal, headers });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export function parseBadges(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // fall back to legacy comma-separated values
  }
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

export const getListings = (params = "") => apiFetch<Listing[]>(`/api/listings${params ? `?${params}` : ""}`);
export const getStats = (days = 7) => apiFetch<{ new_listings: number; avg_price_per_sqm: number | null; top_deals?: number; series?: Array<{ date: string; count: number; avg_ppsqm: number | null }> }>(`/api/stats?days=${days}`);
export const getSources = () => apiFetch<Array<{ name: string; health_status: string; reliability_score?: number }>>(`/api/sources`);
export const getClusters = () => apiFetch<Array<{ cluster_id: string; members_count: number; sources?: string[]; canonical_listing_id?: number; canonical?: Listing; members: Listing[] }>>(`/api/clusters`);
export const getPriceDrops = () => apiFetch<Listing[]>(`/api/price-drops`);
export const getOffMarket = (params = "") => apiFetch<Listing[]>(`/api/off-market${params ? `?${params}` : ""}`);
export const getDistricts = () => apiFetch<Array<{ district: string; listing_count: number; median_or_avg_ppsqm: number | null; top_deals: number; avg_score: number | null }>>(`/api/districts`);
export const getAnalytics = (days = 30) => apiFetch<{
  source_distribution: Array<{ source: string; count: number }>;
  price_bands: Array<{ band: string; count: number }>;
  district_stats: Array<{ district: string; count: number; avg_ppsqm: number | null }>;
  trend_insights: Array<{ date: string; count: number; avg_ppsqm: number | null }>;
}>(`/api/analytics?days=${days}`);
