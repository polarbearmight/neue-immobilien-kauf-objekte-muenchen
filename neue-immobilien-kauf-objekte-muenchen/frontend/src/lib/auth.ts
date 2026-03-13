import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const USERNAME = process.env.MDF_USERNAME || "admin";
export const SECRET = process.env.MDF_AUTH_SECRET || "mdf-local-secret";
const envPath = path.resolve(process.cwd(), ".env.local");

export function getPassword() {
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, "utf8");
    const match = env.match(/^MDF_PASSWORD=(.*)$/m);
    if (match?.[1]) return match[1].trim();
  }
  return process.env.MDF_PASSWORD || "admin123";
}

export function signAuth(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export function authToken() {
  const payload = `${USERNAME}:authenticated`;
  return `${payload}.${signAuth(payload)}`;
}

export function isValidAuthToken(token?: string | null) {
  if (!token) return false;
  const payload = `${USERNAME}:authenticated`;
  return token === `${payload}.${signAuth(payload)}`;
}
