import { NextResponse } from "next/server";

const API_BASE = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:7001";

export async function GET() {
  const res = await fetch(`${API_BASE}/api/legal/contact`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
