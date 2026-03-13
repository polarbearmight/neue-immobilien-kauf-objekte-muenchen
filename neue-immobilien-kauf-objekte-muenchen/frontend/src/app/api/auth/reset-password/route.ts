import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || "").trim();

  if (password.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }

  let env = "";
  try {
    env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    if (/^MDF_PASSWORD=/m.test(env)) {
      env = env.replace(/^MDF_PASSWORD=.*$/m, `MDF_PASSWORD=${password}`);
    } else {
      env += `${env.endsWith("\n") || env.length === 0 ? "" : "\n"}MDF_PASSWORD=${password}\n`;
    }
    fs.writeFileSync(envPath, env, "utf8");
  } catch {
    return NextResponse.json({ error: "Passwort konnte nicht gespeichert werden." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
