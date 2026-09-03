"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import LedgerSheet, { type Business, type Ledger } from "@/components/LedgerSheet";

export default function SharedLedgerPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<(Ledger & { business: Business }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Ledger & { business: Business }>(`/api/public/share/${token}`, { auth: false })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "This link could not be opened"));
  }, [token]);

  if (error)
    return (
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-semibold">Could not open this statement</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  if (!data) return <div className="p-8 text-center text-gray-400">Loading statement…</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Statement for <b>{data.party.name}</b> from <b>{data.business.name}</b>
        </p>
        <button onClick={() => window.print()} className="btn-primary">
          🖨️ Save as PDF
        </button>
      </div>
      <LedgerSheet data={data} business={data.business} />
      <p className="no-print mt-4 text-center text-xs text-slate-400">
        Shared securely via Laxora Billing
      </p>
    </div>
  );
}
