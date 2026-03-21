import { NextRequest, NextResponse } from "next/server";
import { parseAuthToken } from "@/lib/auth";

const API_BASE = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:7001";

export async function POST(req: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
  const auth = parseAuthToken(req.cookies.get("mdf_auth")?.value);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { listingId } = await params;
  const url = new URL(`${API_BASE}/api/watchlist/${encodeURIComponent(listingId)}`);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.notes === "string") url.searchParams.set("notes", body.notes);
  const res = await fetch(url.toString(), { method: "POST", headers: { "X-MDF-Username": auth.username } });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
