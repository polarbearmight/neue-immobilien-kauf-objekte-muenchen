import { NextRequest, NextResponse } from "next/server";
import { parseAuthToken } from "@/lib/auth";

const API_BASE = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:7001";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = parseAuthToken(req.cookies.get("mdf_auth")?.value);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { id } = await params;
  const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Auth-User": auth.username }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
