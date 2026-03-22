export type RoleKey = "free" | "pro" | "admin";

export type RoleInfo = {
  role?: string | null;
  effective_role?: string | null;
  license_until?: string | null;
};

export const roleRank: Record<RoleKey, number> = { free: 0, pro: 1, admin: 2 };

export function normalizeRole(role?: string | null): RoleKey {
  const value = String(role || "free").toLowerCase();
  if (value === "admin" || value === "pro" || value === "free") return value;
  return "free";
}

export function getEffectiveRole(roleInfo?: RoleInfo | null): RoleKey {
  return normalizeRole(roleInfo?.effective_role || roleInfo?.role || "free");
}

export function hasMinRole(roleInfo: RoleInfo | RoleKey | null | undefined, minRole: RoleKey): boolean {
  const currentRole = typeof roleInfo === "string" ? normalizeRole(roleInfo) : getEffectiveRole(roleInfo);
  return roleRank[currentRole] >= roleRank[minRole];
}

export function getRolePermissions(roleInfo?: RoleInfo | null) {
  const role = getEffectiveRole(roleInfo);
  const isFree = role === "free";
  const isPro = role === "pro";
  const isAdmin = role === "admin";

  return {
    role,
    isFree,
    isPro,
    isAdmin,
    canSeeDealScore: true,
    canAccessOffMarket: isPro || isAdmin,
    canAccessGeoHeatmap: isPro || isAdmin,
    canAccessSources: isAdmin,
    hasFullSidebarAccess: isAdmin,
  };
}
