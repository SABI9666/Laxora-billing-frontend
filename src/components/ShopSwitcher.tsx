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

  if (memberships.length <= 1) return null;

  return (
    <div className="px-3 pb-3">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
        Active shop
      </label>
      <select
        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
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
  );
}
