"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import InvoiceSheet, { type Business, type Invoice } from "@/components/InvoiceSheet";

export default function SharedInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{ invoice: Invoice; business: Business } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ invoice: Invoice; business: Business }>(`/api/public/share/${token}`, { auth: false })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "This link could not be opened"));
  }, [token]);

  if (error)
    return (
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-semibold">Could not open this bill</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  if (!data) return <div className="p-8 text-center text-gray-400">Loading bill…</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Bill <b>{data.invoice.invoiceNumber}</b> from <b>{data.business.name}</b>
        </p>
        <button onClick={() => window.print()} className="btn-primary">
          🖨️ Save as PDF
        </button>
      </div>
      <InvoiceSheet invoice={data.invoice} business={data.business} />
      <p className="no-print mt-4 text-center text-xs text-slate-400">
        Shared securely via Laxora Billing
      </p>
    </div>
  );
}
