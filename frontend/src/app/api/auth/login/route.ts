import { NextRequest, NextResponse } from "next/server";
import { authToken } from "@/lib/auth";

const API_BASE = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:7001";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const resBackend = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resBackend.json().catch(() => ({}));
  if (!resBackend.ok || !data?.user?.username) {
    return NextResponse.json({ error: data?.error || "Ungültige Zugangsdaten" }, { status: resBackend.status || 401 });
  }

  const token = authToken(data.user.username, !!data.user.is_demo);
  const res = NextResponse.json({ ok: true, user: data.user });
  res.cookies.set("mdf_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set("mdf_auth_client", token, {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
