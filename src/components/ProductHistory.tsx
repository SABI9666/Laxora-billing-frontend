"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import Modal from "@/components/Modal";

// Full life of a product: every sale and purchase (when, which bill, to/from
// whom, qty, rate, amount) plus other stock changes (returns, adjustments,
// transfers, opening stock).

type HistoryLine = {
  date: string;
  invoiceId: string;
  invoiceNumber: string;
  party: string;
  quantity: number;
  rate: number;
  taxRate: number;
  amount: number;
  channel?: string;
  status: string;
};

type OtherMove = {
  date: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  reason?: string | null;
  reference?: string | null;
};

type History = {
  item: {
    id: string;
    name: string;
    sku?: string | null;
    unit: string;
    stockQty: number;
    isService: boolean;
    supplier?: string | null;
  };
  summary: {
    soldQty: number;
    soldAmount: number;
    soldBills: number;
    lastSoldAt: string | null;
    purchasedQty: number;
    purchasedAmount: number;
    purchasedBills: number;
    lastPurchasedAt: string | null;
  };
  sales: HistoryLine[];
  purchases: HistoryLine[];
  other: OtherMove[];
};

const MOVE_LABEL: Record<string, string> = {
  IN: "Stock In",
  OUT: "Stock Out",
  ADJUST: "Adjustment",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
};

export default function ProductHistory({
  itemId,
  itemName,
  onClose,
}: {
  itemId: string;
  itemName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"sales" | "purchases" | "other">("sales");

  useEffect(() => {
    api<History>(`/api/items/${itemId}/history`)
      .then(setData)
      .catch(() => setError("Could not load the product history."));
  }, [itemId]);

  const rows = data ? (tab === "other" ? [] : data[tab]) : [];

  return (
    <Modal title={`📜 Product History — ${itemName}`} onClose={onClose} wide>
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {!data && !error && <p className="py-8 text-center text-sm text-gray-400">Loading…</p>}

      {data && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                Sold
              </p>
              <p className="text-lg font-bold text-emerald-700">
                {data.summary.soldQty} {data.item.unit}
              </p>
              <p className="text-xs text-emerald-600">
                {formatMoney(data.summary.soldAmount)} · {data.summary.soldBills} bill
                {data.summary.soldBills === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                Purchased
              </p>
              <p className="text-lg font-bold text-amber-700">
                {data.summary.purchasedQty} {data.item.unit}
              </p>
              <p className="text-xs text-amber-600">
                {formatMoney(data.summary.purchasedAmount)} · {data.summary.purchasedBills} bill
                {data.summary.purchasedBills === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                In Stock
              </p>
              <p className="text-lg font-bold text-slate-700">
                {data.item.isService ? "—" : `${data.item.stockQty} ${data.item.unit}`}
              </p>
              {data.item.supplier && (
                <p className="truncate text-xs text-slate-500">from {data.item.supplier}</p>
              )}
            </div>
            <div className="rounded-xl bg-indigo-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
                Last Sold / Bought
              </p>
              <p className="text-sm font-bold text-indigo-700">
                {data.summary.lastSoldAt ? formatDate(data.summary.lastSoldAt) : "never"}
              </p>
              <p className="text-xs text-indigo-500">
                bought {data.summary.lastPurchasedAt ? formatDate(data.summary.lastPurchasedAt) : "never"}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5">
            {(
              [
                ["sales", `Sales (${data.sales.length})`],
                ["purchases", `Purchases (${data.purchases.length})`],
                ["other", `Other (${data.other.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  tab === key
                    ? "bg-brand text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab !== "other" ? (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">Bill</th>
                    <th className="table-th">{tab === "sales" ? "Customer" : "Supplier"}</th>
                    <th className="table-th text-right">Qty</th>
                    <th className="table-th text-right">Rate</th>
                    <th className="table-th text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, i) => (
                    <tr key={`${r.invoiceId}-${i}`}>
                      <td className="table-td whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="table-td">
                        <span className="font-semibold text-slate-700">{r.invoiceNumber}</span>
                        {r.channel === "ONLINE" && (
                          <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
                            ONLINE
                          </span>
                        )}
                      </td>
                      <td className="table-td">{r.party}</td>
                      <td className="table-td text-right">{r.quantity}</td>
                      <td className="table-td text-right">{formatMoney(r.rate)}</td>
                      <td
                        className={`table-td text-right font-semibold ${
                          tab === "sales" ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {formatMoney(r.amount)}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="table-td text-gray-400" colSpan={6}>
                        {tab === "sales"
                          ? "This product has not been sold yet."
                          : "No purchase bills for this product yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">What</th>
                    <th className="table-th">Details</th>
                    <th className="table-th text-right">Qty</th>
                    <th className="table-th text-right">Stock After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.other.map((m, i) => (
                    <tr key={i}>
                      <td className="table-td whitespace-nowrap">{formatDate(m.date)}</td>
                      <td className="table-td font-medium">{MOVE_LABEL[m.type] ?? m.type}</td>
                      <td className="table-td text-gray-500">
                        {m.reason ?? "—"}
                        {m.reference ? ` (${m.reference})` : ""}
                      </td>
                      <td
                        className={`table-td text-right font-semibold ${
                          m.quantity >= 0 ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {m.quantity >= 0 ? "+" : ""}
                        {m.quantity}
                      </td>
                      <td className="table-td text-right">{m.balanceAfter}</td>
                    </tr>
                  ))}
                  {data.other.length === 0 && (
                    <tr>
                      <td className="table-td text-gray-400" colSpan={5}>
                        No returns, adjustments or transfers for this product.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
