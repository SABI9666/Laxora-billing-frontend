"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  amountPaid: string;
  invoiceDate: string;
  externalRef?: string | null;
  party: { name: string };
};

type InvoiceDetail = Invoice & {
  notes?: string | null;
  subtotal: string;
  discount: string;
  party: { name: string; phone?: string | null; email?: string | null };
  items: { id: string; description: string; quantity: string; rate: string; amount: string }[];
};

export default function OnlineOrdersPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ invoices: Invoice[] }>("/api/invoices?channel=ONLINE");
      setInvoices(r.invoices);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function openDetail(inv: Invoice) {
    const r = await api<{ invoice: InvoiceDetail }>(`/api/invoices/${inv.id}`);
    setDetail(r.invoice);
  }

  const totalSales = invoices.reduce((s, i) => s + Number(i.total), 0);

  return (
    <div>
      <PageHeader title="Online Orders" />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Online bills</p>
          <p className="mt-1 text-2xl font-bold">{invoices.length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Online sales</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(totalSales)}</p>
        </div>
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Bill No</th>
                <th className="table-th">Website Order</th>
                <th className="table-th">Customer</th>
                <th className="table-th">Date</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Total</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="table-td font-medium">{inv.invoiceNumber}</td>
                  <td className="table-td text-gray-500">
                    {inv.externalRef ? `#${inv.externalRef.slice(-8).toUpperCase()}` : "—"}
                  </td>
                  <td className="table-td">{inv.party?.name}</td>
                  <td className="table-td">{formatDate(inv.invoiceDate)}</td>
                  <td className="table-td">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        inv.status === "PAID"
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="table-td text-right">{formatMoney(inv.total)}</td>
                  <td className="table-td text-right">
                    <button
                      onClick={() => openDetail(inv)}
                      className="mr-3 text-brand hover:underline"
                    >
                      View
                    </button>
                    <Link
                      href={`/invoices/${inv.id}/print`}
                      className="text-brand hover:underline"
                    >
                      Bill / PDF
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={7}>
                    No online orders yet. Connect the website from Settings → Online Store —
                    every paid website order then creates a bill here automatically and
                    reduces this shop&apos;s stock.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={7}>
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <Modal title={`Online order — ${detail.invoiceNumber}`} onClose={() => setDetail(null)}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold">{detail.party?.name}</p>
              <p className="text-gray-500">
                {[detail.party?.phone, detail.party?.email].filter(Boolean).join(" · ")}
              </p>
            </div>
            {detail.notes && (
              <div className="whitespace-pre-line rounded-lg bg-gray-50 p-3 text-gray-600">
                {detail.notes}
              </div>
            )}
            <div className="space-y-2">
              {detail.items.map((l) => (
                <div key={l.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <div className="font-medium">{l.description}</div>
                    <div className="text-xs text-gray-500">
                      {Number(l.quantity)} × {formatMoney(l.rate)}
                    </div>
                  </div>
                  <div>{formatMoney(l.amount)}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatMoney(detail.total)}</span>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setDetail(null)}>
                Close
              </button>
              <Link href={`/invoices/${detail.id}/print`} className="btn-primary">
                Print Bill
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
