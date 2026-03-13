import crypto from "node:crypto";

export const SECRET = process.env.MDF_AUTH_SECRET || "mdf-local-secret";

export function signAuth(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export function authToken(username: string) {
  const payload = `${username}:authenticated`;
  return `${payload}.${signAuth(payload)}`;
}

export function parseAuthToken(token?: string | null) {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  if (signAuth(payload) !== signature) return null;
  const [username, marker] = payload.split(":");
  if (!username || marker !== "authenticated") return null;
  return { username };
}

export function isValidAuthToken(token?: string | null) {
  return !!parseAuthToken(token);
}
