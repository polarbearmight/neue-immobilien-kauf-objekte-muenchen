import { Listing, parseBadges } from "@/lib/api";

export type HighlightBadge = {
  key: string;
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "premium";
};

export function listingHighlightBadges(l: Listing): HighlightBadge[] {
  const out: HighlightBadge[] = [];
  const ageHours = (Date.now() - new Date(l.first_seen_at).getTime()) / 3600000;
  const parsedBadges = parseBadges(l.badges);
  const score = l.deal_score || 0;

  if (score >= 95) out.push({ key: "ultra", label: "ULTRA DEAL", tone: "premium" });
  else if (score >= 85) out.push({ key: "top", label: "TOP DEAL", tone: "success" });

  if (ageHours <= 2) out.push({ key: "just", label: "JUST LISTED", tone: "success" });
  else if (ageHours <= 6) out.push({ key: "brand", label: "BRAND NEW", tone: "neutral" });

  if (parsedBadges.includes("PRICE_DROP")) out.push({ key: "drop", label: "PRICE DROP", tone: "success" });
  if (parsedBadges.includes("CHECK")) out.push({ key: "check", label: "CHECK", tone: "warning" });
  if (parsedBadges.includes("OFF_MARKET")) out.push({ key: "off", label: "OFF MARKET", tone: "premium" });

  return out;
}

export function listingHighlightRowClass(l: Listing): string {
  const parsedBadges = parseBadges(l.badges);
  const score = l.deal_score || 0;
  if (score >= 95) return "border-l-4 border-l-amber-500 bg-amber-50/35 dark:border-l-amber-300 dark:bg-[linear-gradient(180deg,rgba(94,74,25,0.32),rgba(245,197,66,0.04))]";
  if (score >= 85) return "border-l-4 border-l-emerald-500 bg-emerald-50/28 dark:border-l-emerald-400 dark:bg-[linear-gradient(180deg,rgba(14,55,43,0.36),rgba(255,255,255,0.02))]";
  if (parsedBadges.includes("CHECK")) return "border-l-4 border-l-amber-500 bg-amber-50/30 dark:border-l-amber-400 dark:bg-[linear-gradient(180deg,rgba(92,66,18,0.28),rgba(255,255,255,0.02))]";
  return "";
}

export function badgeToneClass(tone: HighlightBadge["tone"]): string {
  if (tone === "premium") return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-300/40 dark:bg-amber-300/16 dark:text-amber-100";
  if (tone === "success") return "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/14 dark:text-emerald-100";
  if (tone === "warning") return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/34 dark:bg-amber-400/14 dark:text-amber-100";
  if (tone === "danger") return "border-red-300 bg-red-100 text-red-900 dark:border-red-400/30 dark:bg-red-500/14 dark:text-red-100";
  return "border-slate-300 bg-slate-100 text-slate-900 dark:border-white/12 dark:bg-white/[0.05] dark:text-amber-50/88";
}
