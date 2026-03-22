"use client";

import { useEffect, useState } from "react";
import { getRolePermissions, type RoleInfo } from "@/lib/roles";

export function useRolePermissions(initialRoleInfo?: RoleInfo | null) {
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(initialRoleInfo ?? null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return;
        setRoleInfo(json?.user || null);
      })
      .catch(() => {
        if (!mounted) return;
        setRoleInfo(initialRoleInfo ?? null);
      });
    return () => {
      mounted = false;
    };
  }, [initialRoleInfo]);

  return getRolePermissions(roleInfo);
}
