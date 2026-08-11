"use client";

import { useEffect, useState } from "react";
import { api, getBusinessId, setBusinessId } from "@/lib/api";

type Membership = {
  role: string;
  business: {
    id: string;
    name: string;
    code?: string | null;
    franchiseId?: string | null;
    franchise?: { id: string; name: string } | null;
  };
};

// Lets a user (especially a franchise admin with many shops) pick the active
// shop. The choice is stored as the `x-business-id` header for all API calls.
export default function ShopSwitcher() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    api<{ user: { memberships: Membership[] } }>("/api/auth/me")
      .then((r) => {
        const ms = r.user.memberships;
        setMemberships(ms);
        const current = getBusinessId();
        if (current && ms.some((m) => m.business.id === current)) {
          setActive(current);
        } else if (ms[0]) {
          setActive(ms[0].business.id);
          setBusinessId(ms[0].business.id);
        }
      })
      .catch(() => {});
  }, []);

  function onChange(id: string) {
    setActive(id);
    setBusinessId(id);
    // Reload so every page refetches against the newly selected shop.
    window.location.reload();
  }

  if (memberships.length === 0) return null;

  const activeShop = memberships.find((m) => m.business.id === active)?.business;

  // Single-shop login: just show the shop name (no dropdown needed).
  if (memberships.length === 1) {
    return (
      <div className="px-3 pb-3">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
          Shop
        </label>
        <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm font-semibold text-gray-800">
          {activeShop?.name ?? "—"}
          {activeShop?.code ? (
            <span className="ml-1 font-normal text-gray-400">({activeShop.code})</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
        Active shop — tap to switch
      </label>
      <div className="flex items-center gap-2 rounded-xl border-2 border-brand/40 bg-brand-light/30 px-2 py-2">
        <span className="text-base">🏪</span>
        <select
          className="w-full cursor-pointer bg-transparent text-sm font-semibold text-slate-800 outline-none"
          value={active}
          onChange={(e) => onChange(e.target.value)}
        >
          {memberships.map((m) => (
            <option key={m.business.id} value={m.business.id}>
              {m.business.name}
              {m.business.code ? ` (${m.business.code})` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
