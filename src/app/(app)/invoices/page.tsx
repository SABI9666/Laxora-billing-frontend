"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [type, setType] = useState<"" | "SALE" | "PURCHASE">("");

  async function load() {
    const q = type ? `?type=${type}` : "";
    const r = await api<{ invoices: Invoice[] }>(`/api/invoices${q}`);
    setInvoices(r.invoices);
  }
  useEffect(() => {
    load();
  }, [type]);

  async function remove(inv: Invoice) {
    if (!confirm(`Delete ${inv.invoiceNumber}? Stock will be restored.`)) return;
    await api(`/api/invoices/${inv.id}`, { method: "DELETE" });
    await load();
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
                    <button
                      onClick={() => remove(inv)}
                      className="text-red-600 hover:underline"
                    >
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
    </div>
  );
}
