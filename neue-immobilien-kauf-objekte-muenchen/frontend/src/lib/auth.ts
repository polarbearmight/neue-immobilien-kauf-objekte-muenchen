import crypto from "node:crypto";

const SECRET = process.env.MDF_AUTH_SECRET || "mdf-local-secret";
const USERNAME = process.env.MDF_USERNAME || "admin";

function sign(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export function isValidAuthCookie(raw?: string | null) {
  if (!raw || !raw.includes(".")) return false;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  const ok = crypto.timingSafeEqual(a, b);
  return ok && payload === `${USERNAME}:authenticated`;
}
