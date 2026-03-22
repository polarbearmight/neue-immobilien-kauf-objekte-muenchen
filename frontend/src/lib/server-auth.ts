import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseAuthToken } from "@/lib/auth";
import { hasMinRole, type RoleInfo, type RoleKey } from "@/lib/roles";

const API_BASE = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:7001";

export async function getCurrentUserServer() {
  const cookieStore = await cookies();
  const auth = parseAuthToken(cookieStore.get("mdf_auth")?.value);
  if (!auth) return null;
  const res = await fetch(`${API_BASE}/api/auth/users/${encodeURIComponent(auth.username)}`, {
    cache: "no-store",
    headers: { "X-Auth-User": auth.username },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return (data?.user || null) as RoleInfo | null;
}

export async function requireServerRole(minRole: RoleKey) {
  const user = await getCurrentUserServer();
  if (!user) redirect("/");
  if (!hasMinRole(user, minRole)) redirect("/dashboard");
  return user;
}
