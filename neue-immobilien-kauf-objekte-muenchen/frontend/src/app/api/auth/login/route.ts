import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const USERNAME = process.env.MDF_USERNAME || "admin";
const PASSWORD = process.env.MDF_PASSWORD || "admin123";
const SECRET = process.env.MDF_AUTH_SECRET || "mdf-local-secret";

function sign(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = body?.username;
  const password = body?.password;

  if (username !== USERNAME || password !== PASSWORD) {
    return NextResponse.json({ error: "Ungültige Zugangsdaten" }, { status: 401 });
  }

  const payload = `${USERNAME}:authenticated`;
  const token = `${payload}.${sign(payload)}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set("mdf_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
