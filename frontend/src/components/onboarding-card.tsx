"use client";

import { useState } from "react";

export function OnboardingCard() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || typeof window !== "undefined" && window.localStorage.getItem("mdf_onboarding_done") === "1") {
    return null;
  }

  const finish = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mdf_onboarding_done", "1");
    }
    setDismissed(true);
  };

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">Willkommen im ImmoDealFinder</p>
          <p className="mt-1 text-emerald-900/80">Starte am besten mit Dashboard, Deal Radar und Watchlist. Über Settings kannst du danach Regeln und Schwellwerte anpassen.</p>
        </div>
        <div className="flex gap-2">
          <a href="/settings" className="rounded-xl border border-emerald-300 bg-white px-4 py-2 font-medium">Zu den Settings</a>
          <button className="rounded-xl bg-emerald-700 px-4 py-2 font-medium text-white" onClick={finish}>Verstanden</button>
        </div>
      </div>
    </div>
  );
}
