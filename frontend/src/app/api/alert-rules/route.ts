import { NextRequest, NextResponse } from "next/server";
import { parseAuthToken } from "@/lib/auth";

const API_BASE = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:7001";

export async function GET(req: NextRequest) {
  const auth = parseAuthToken(req.cookies.get("mdf_auth")?.value);
  const headers: Record<string, string> = {};
  if (auth?.username) headers["X-MDF-Username"] = auth.username;
  const res = await fetch(`${API_BASE}/api/alert-rules`, { cache: "no-store", headers });
  const data = await res.json().catch(() => ([]));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const auth = parseAuthToken(req.cookies.get("mdf_auth")?.value);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_BASE}/api/alert-rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-MDF-Username": auth.username },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
