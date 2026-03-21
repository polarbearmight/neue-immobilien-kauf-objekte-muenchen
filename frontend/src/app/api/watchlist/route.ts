import { NextRequest, NextResponse } from "next/server";
import { parseAuthToken } from "@/lib/auth";

const API_BASE = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:7001";

export async function GET(req: NextRequest) {
  const auth = parseAuthToken(req.cookies.get("mdf_auth")?.value);
  const headers: Record<string, string> = {};
  if (auth?.username) headers["X-MDF-Username"] = auth.username;
  const res = await fetch(`${API_BASE}/api/watchlist`, { cache: "no-store", headers });
  const data = await res.json().catch(() => ([]));
  return NextResponse.json(data, { status: res.status });
}
