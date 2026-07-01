"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Invoice = {
  id: string;
  invoiceNumber: string;
  type: "SALE" | "PURCHASE";
  status: string;
  total: string;
  amountPaid: string;
  invoiceDate: string;
  party: { name: string };
};
type Line = {
  id: string;
  description: string;
  quantity: string;
  rate: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [type, setType] = useState<"" | "SALE" | "PURCHASE">("");

  // Return modal state
  const [returnInv, setReturnInv] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const q = type ? `?type=${type}` : "";
    const r = await api<{ invoices: Invoice[] }>(`/api/invoices${q}`);
    setInvoices(r.invoices);
  }
  useEffect(() => {
    load();
  }, [type]);

  async function remove(inv: Invoice) {
    if (
      !confirm(
        `Delete ${inv.invoiceNumber}? This will be sent to the admin for approval.`
      )
    )
      return;
    const r = await api<{ pending?: boolean; message?: string } | undefined>(
      `/api/invoices/${inv.id}`,
      { method: "DELETE" }
    );
    if (r?.pending) {
      setNotice(r.message ?? "Deletion sent to the admin for approval.");
    }
    await load();
  }

  async function openReturn(inv: Invoice) {
    setError("");
    setReason("");
    setRetQty({});
    setReturnInv(inv);
    const r = await api<{ invoice: { items: Line[] } }>(`/api/invoices/${inv.id}`);
    setLines(r.invoice.items.filter((l) => Number(l.quantity) > 0));
  }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnInv) return;
    const items = Object.entries(retQty)
      .filter(([, q]) => q > 0)
      .map(([invoiceItemId, quantity]) => ({ invoiceItemId, quantity }));
    if (items.length === 0) {
      setError("Enter a return quantity for at least one item");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api(`/api/invoices/${returnInv.id}/return`, {
        method: "POST",
        body: { items, reason: reason || undefined },
      });
      setReturnInv(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record return");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        action={
          <Link href="/invoices/new" className="btn-primary">
            + New Invoice
          </Link>
        }
      />

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-amber-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {[
          { v: "", label: "All" },
          { v: "SALE", label: "Sales" },
          { v: "PURCHASE", label: "Purchases" },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setType(t.v as any)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              type === t.v ? "bg-brand text-white" : "bg-white border border-gray-300 text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Number</th>
                <th className="table-th">Type</th>
                <th className="table-th">Party</th>
                <th className="table-th">Date</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Total</th>
                <th className="table-th text-right">Due</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="table-td font-medium">{inv.invoiceNumber}</td>
                  <td className="table-td">{inv.type}</td>
                  <td className="table-td">{inv.party?.name}</td>
                  <td className="table-td">{formatDate(inv.invoiceDate)}</td>
                  <td className="table-td">{inv.status}</td>
                  <td className="table-td text-right">{formatMoney(inv.total)}</td>
                  <td className="table-td text-right">
                    {formatMoney(Number(inv.total) - Number(inv.amountPaid))}
                  </td>
                  <td className="table-td text-right">
                    <Link
                      href={`/invoices/${inv.id}/print`}
                      className="mr-3 text-brand hover:underline"
                    >
                      PDF
                    </Link>
                    <Link
                      href={`/invoices/${inv.id}/edit`}
                      className="mr-3 text-brand hover:underline"
                    >
                      Edit
                    </Link>
                    {inv.type === "SALE" && (
                      <button
                        onClick={() => openReturn(inv)}
                        className="mr-3 text-brand hover:underline"
                      >
                        Return
                      </button>
                    )}
                    <button onClick={() => remove(inv)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={8}>
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {returnInv && (
        <Modal
          title={`Return items — ${returnInv.invoiceNumber}`}
          onClose={() => setReturnInv(null)}
        >
          <form onSubmit={submitReturn} className="space-y-4">
            {error && <div className="text-sm text-red-600">{error}</div>}
            <p className="text-sm text-gray-500">
              Enter how many of each item the customer is returning. Stock goes back up and
              the bill/profit is adjusted automatically.
            </p>
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center gap-2 border-b pb-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{l.description}</div>
                    <div className="text-xs text-gray-500">
                      Sold: {Number(l.quantity)} @ {formatMoney(l.rate)}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={Number(l.quantity)}
                    step="0.001"
                    placeholder="0"
                    className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
                    value={retQty[l.id] ?? ""}
                    onChange={(e) =>
                      setRetQty({
                        ...retQty,
                        [l.id]: Math.min(Number(e.target.value), Number(l.quantity)),
                      })
                    }
                  />
                </div>
              ))}
              {lines.length === 0 && (
                <p className="text-sm text-gray-400">No returnable items on this bill.</p>
              )}
            </div>
            <div>
              <label className="label">Reason (optional)</label>
              <input
                className="input"
                placeholder="e.g. damaged / wrong item"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setReturnInv(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Processing…" : "Record Return"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
