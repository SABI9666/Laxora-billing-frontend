"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import InvoiceSheet, { invoiceFigures, type Business, type Invoice } from "@/components/InvoiceSheet";
import ShareMenu from "@/components/ShareMenu";

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api<{ invoice: Invoice }>(`/api/invoices/${id}`)
      .then((r) => setInvoice(r.invoice))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the bill"));
    api<{ business: Business }>("/api/business")
      .then((r) => setBusiness(r.business))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load shop details"));
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Could not open this bill</p>
          <p className="mt-1">{error}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => window.location.reload()} className="btn-primary">
              Try again
            </button>
            <button onClick={() => router.back()} className="btn-secondary">
              ← Back
            </button>
          </div>
        </div>
      </div>
    );

  if (!invoice || !business)
    return <div className="p-8 text-gray-400">Loading invoice…</div>;

  const f = invoiceFigures(invoice);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hide app chrome when printing */}
      <style>{`
        @media print {
          aside, .no-print { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .invoice-sheet { border: none !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => router.back()} className="btn-secondary">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <ShareMenu
            kind="invoice"
            id={invoice.id}
            phone={invoice.party?.phone}
            title={`Bill ${invoice.invoiceNumber}`}
            message={[
              `*${business.name}*`,
              `Bill ${invoice.invoiceNumber} · ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
              `${f.returned > 0 ? "Net payable" : "Amount"}: ${formatMoney(f.netPayable)}`,
              f.balance > 0.009
                ? `Balance due: ${formatMoney(f.balance)}`
                : "Fully paid — thank you!",
            ].join("\n")}
          />
          <button onClick={() => window.print()} className="btn-primary">
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      <InvoiceSheet invoice={invoice} business={business} />
    </div>
  );
}
