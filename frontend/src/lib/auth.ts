import crypto from "node:crypto";

export const SECRET = process.env.MDF_AUTH_SECRET || "mdf-local-secret";

export function signAuth(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export function authToken(username: string, isDemo: boolean = false) {
  const payload = `${username}:authenticated:${isDemo ? "demo" : "full"}`;
  return `${payload}.${signAuth(payload)}`;
}

export function parseAuthToken(token?: string | null) {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  if (signAuth(payload) !== signature) return null;
  const parts = payload.split(":");
  const username = parts[0];
  const marker = parts[1];
  const modeFlag = parts[2];
  if (!username || marker !== "authenticated") return null;
  const isDemo = modeFlag === "demo";
  return { username, isDemo };
}

export function isValidAuthToken(token?: string | null) {
  return !!parseAuthToken(token);
}
