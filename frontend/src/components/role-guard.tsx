"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StateCard } from "@/components/state-card";
import { hasMinRole, type RoleKey } from "@/lib/roles";

export function RoleGuard({ minRole, children }: { minRole: RoleKey; children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const ok = hasMinRole(json?.user || null, minRole);
        setAllowed(ok);
        if (!ok) router.replace("/dashboard");
      })
      .catch(() => {
        setAllowed(false);
        router.replace("/");
      });
  }, [minRole, router]);

  if (allowed === null) return <StateCard title="Zugriff wird geprüft" body="Rolle und Freigaben werden geladen." tone="muted" />;
  if (!allowed) return <StateCard title="Kein Zugriff" body="Du wirst auf eine verfügbare Ansicht weitergeleitet." tone="error" />;
  return <>{children}</>;
}
