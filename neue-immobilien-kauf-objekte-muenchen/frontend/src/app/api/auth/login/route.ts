import { NextRequest, NextResponse } from "next/server";
import { authToken, getPassword, USERNAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = body?.username;
  const password = body?.password;

  if (username !== USERNAME || password !== getPassword()) {
    return NextResponse.json({ error: "Ungültige Zugangsdaten" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("mdf_auth", authToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
