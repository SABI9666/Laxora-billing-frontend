"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

type Summary = {
  totalSales: number;
  salesCount: number;
  totalPurchases: number;
  totalReceivable: number;
  partyCount: number;
  itemCount: number;
  lowStockCount: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  type: string;
  total: string;
  status: string;
  invoiceDate: string;
  party: { name: string };
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Invoice[]>([]);

  useEffect(() => {
    api<{ summary: Summary }>("/api/dashboard/summary").then((r) =>
      setSummary(r.summary)
    );
    api<{ invoices: Invoice[] }>("/api/dashboard/recent-invoices").then((r) =>
      setRecent(r.invoices)
    );
  }, []);

  const cards = [
    { label: "Total Sales", value: summary && formatMoney(summary.totalSales) },
    { label: "Receivables", value: summary && formatMoney(summary.totalReceivable) },
    { label: "Purchases", value: summary && formatMoney(summary.totalPurchases) },
    { label: "Low Stock Items", value: summary?.lowStockCount },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        action={
          <Link href="/invoices/new" className="btn-primary">
            + New Invoice
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {c.value ?? "—"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 card p-0">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold">Recent Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Number</th>
                <th className="table-th">Party</th>
                <th className="table-th">Date</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.map((inv) => (
                <tr key={inv.id}>
                  <td className="table-td font-medium">{inv.invoiceNumber}</td>
                  <td className="table-td">{inv.party?.name}</td>
                  <td className="table-td">{formatDate(inv.invoiceDate)}</td>
                  <td className="table-td">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="table-td text-right">{formatMoney(inv.total)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={5}>
                    No invoices yet. Create your first one!
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    UNPAID: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}
