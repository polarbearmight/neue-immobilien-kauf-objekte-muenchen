import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Reset access</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Passwort zurücksetzen</h1>
        <p className="mt-4 text-slate-600">Für den aktuellen geschützten Zugang läuft der Reset direkt innerhalb der App. Lege jetzt ein neues Passwort fest.</p>
        <Link href="/reset-password?token=local-reset" className="mt-8 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Zum Reset-Formular</Link>
      </div>
    </div>
  );
}
