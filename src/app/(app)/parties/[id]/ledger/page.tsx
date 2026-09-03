"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import LedgerSheet, { type Business, type Ledger } from "@/components/LedgerSheet";
import ShareMenu from "@/components/ShareMenu";

export default function PartyLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Ledger | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api<Ledger>(`/api/parties/${id}/ledger`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the statement"));
    api<{ business: Business }>("/api/business")
      .then((r) => setBusiness(r.business))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load shop details"));
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Could not open this statement</p>
          <p className="mt-1">{error}</p>
          <button onClick={() => router.back()} className="btn-secondary mt-3">
            ← Back
          </button>
        </div>
      </div>
    );

  if (!data || !business) return <div className="p-8 text-gray-400">Loading statement…</div>;

  const isCustomer = data.party.type === "CUSTOMER";
  const bal = data.closingBalance;

  return (
    <div className="mx-auto max-w-3xl">
      <style>{`
        @media print {
          aside, .no-print { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .sheet { border: none !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => router.back()} className="btn-secondary">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <ShareMenu
            kind="ledger"
            id={data.party.id}
            phone={data.party.phone}
            title={`Statement — ${data.party.name}`}
            message={[
              `*${business.name}*`,
              `Statement of account for ${data.party.name} as on ${formatDate(new Date())}`,
              bal > 0.009
                ? `${isCustomer ? "Balance due" : "Balance payable"}: ${formatMoney(bal)}`
                : bal < -0.009
                ? `Advance: ${formatMoney(Math.abs(bal))}`
                : "Account settled — thank you!",
            ].join("\n")}
          />
          <button onClick={() => window.print()} className="btn-primary">
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      <LedgerSheet data={data} business={business} />
    </div>
  );
}
