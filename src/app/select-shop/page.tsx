"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, getBusinessId, setBusinessId, clearSession } from "@/lib/api";

type Membership = {
  role: string;
  business: {
    id: string;
    name: string;
    code?: string | null;
  };
};

// Shown right after login when the same staff login runs more than one shop
// (e.g. Laxora Peravoor and Laxora Decorative): pick which shop to work in.
// The choice can be changed any time from the sidebar's shop switcher.
export default function SelectShopPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<{ user: { name: string; memberships: Membership[] } }>("/api/auth/me")
      .then((r) => {
        const ms = r.user.memberships;
        if (ms.length === 0) {
          setError("No shop is linked to this login yet. Contact your admin.");
        } else if (ms.length === 1) {
          // Only one shop — nothing to choose.
          setBusinessId(ms[0].business.id);
          router.replace("/dashboard");
          return;
        }
        setMemberships(ms);
      })
      .catch(() => setError("Could not load your shops. Please sign in again."))
      .finally(() => setLoading(false));
  }, [router]);

  function pick(id: string) {
    setBusinessId(id);
    router.replace("/dashboard");
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const current = getBusinessId();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-slate-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-black text-white shadow-lg shadow-brand/20">
            L
          </div>
          <h1 className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-2xl font-extrabold text-transparent">
            Select your shop
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Which shop are you working in right now?
          </p>
        </div>

        <div className="card space-y-3 shadow-lg">
          {loading && <p className="py-6 text-center text-sm text-slate-400">Loading shops…</p>}
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {memberships.map((m) => (
            <button
              key={m.business.id}
              onClick={() => pick(m.business.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition hover:border-brand hover:bg-brand-light/40 ${
                current === m.business.id
                  ? "border-brand bg-brand-light/30"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
                🏪
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-800">
                  {m.business.name}
                </span>
                <span className="block text-xs text-slate-400">
                  {m.business.code ? `${m.business.code} · ` : ""}
                  {m.role}
                </span>
              </span>
              <span className="text-slate-300">→</span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          You can switch shops any time from the sidebar.{" "}
          <button onClick={logout} className="font-medium text-brand hover:underline">
            Log out
          </button>
        </p>
      </div>
    </div>
  );
}
