"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

type Row = {
  id: string;
  name: string;
  phone?: string | null;
  billed: number;
  paid: number;
  balance: number;
};
type Ledger = {
  party: { id: string; name: string; type: string; openingBalance: number };
  closingBalance: number;
  ledger: {
    date: string;
    kind: string;
    ref: string;
    // Detail under the line, e.g. a charge's note and how it was settled.
    note?: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
};

export default function LedgersPage() {
  const [tab, setTab] = useState<"customers" | "suppliers">("customers");
  const [rows, setRows] = useState<Row[]>([]);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLedger(null);
    const type = tab === "customers" ? "CUSTOMER" : "SUPPLIER";
    const r = await api<{ parties: Row[] }>(`/api/parties/summary?type=${type}`);
    setRows(r.parties);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function openLedger(id: string) {
    setLedger(await api<Ledger>(`/api/parties/${id}/ledger`));
  }

  const term = search.trim().toLowerCase();
  const visible = term ? rows.filter((r) => r.name.toLowerCase().includes(term)) : rows;
  const isCustomer = tab === "customers";

  return (
    <div>
      <PageHeader title="Ledgers" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["customers", "suppliers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-brand text-white" : "bg-white text-gray-600"
            }`}
          >
            {t === "customers" ? "Customer Ledger" : "Purchase Ledger"}
          </button>
        ))}
        <input
          className="input ml-auto max-w-xs"
          placeholder={`🔍 Search ${isCustomer ? "customers" : "suppliers"}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Party balances */}
        <div className="card p-0">
          <div className="border-b px-5 py-3 font-semibold">
            {isCustomer ? "Customers" : "Suppliers"}
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th text-right">Billed</th>
                  <th className="table-th text-right">Paid</th>
                  <th className="table-th text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openLedger(r.id)}
                  >
                    <td className="table-td font-medium text-brand">{r.name}</td>
                    <td className="table-td text-right">{formatMoney(r.billed)}</td>
                    <td className="table-td text-right">{formatMoney(r.paid)}</td>
                    <td
                      className={`table-td text-right font-semibold ${
                        r.balance > 0 ? "text-red-600" : r.balance < 0 ? "text-green-700" : ""
                      }`}
                    >
                      {formatMoney(r.balance)}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td className="table-td text-gray-400" colSpan={4}>
                      None yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-2 text-xs text-gray-400">
            Balance = what {isCustomer ? "the customer still owes you" : "you still owe the supplier"}.
            Click a name to see the full ledger.
          </p>
        </div>

        {/* Ledger detail */}
        <div className="card p-0">
          <div className="flex items-center justify-between border-b px-5 py-3 font-semibold">
            <span>{ledger ? `${ledger.party.name} — Ledger` : "Select a name to view ledger"}</span>
            {ledger && (
              <Link
                href={`/parties/${ledger.party.id}/ledger`}
                target="_blank"
                className="text-sm font-medium text-brand hover:underline"
              >
                🖨️ Print / PDF
              </Link>
            )}
          </div>
          {ledger && (
            <>
              <div className="max-h-[28rem] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="table-th">Date</th>
                      <th className="table-th">Detail</th>
                      <th className="table-th text-right">Billed</th>
                      <th className="table-th text-right">Paid / Return</th>
                      <th className="table-th text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="table-td text-gray-400" colSpan={4}>
                        Opening balance
                      </td>
                      <td className="table-td text-right">
                        {formatMoney(ledger.party.openingBalance)}
                      </td>
                    </tr>
                    {ledger.ledger.map((e, i) => (
                      <tr key={i}>
                        <td className="table-td">{formatDate(e.date)}</td>
                        <td className="table-td">
                          {e.kind}
                          {e.ref ? ` · ${e.ref}` : ""}
                          {e.note && (
                            <div className="text-xs text-slate-400">{e.note}</div>
                          )}
                        </td>
                        <td className="table-td text-right">
                          {e.debit ? formatMoney(e.debit) : "—"}
                        </td>
                        <td className="table-td text-right text-green-700">
                          {e.credit ? formatMoney(e.credit) : "—"}
                        </td>
                        <td className="table-td text-right font-medium">
                          {formatMoney(e.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t px-5 py-3">
                <span className="font-semibold">
                  {ledger.closingBalance > 0
                    ? isCustomer
                      ? "Balance due from customer"
                      : "Balance payable to supplier"
                    : ledger.closingBalance < 0
                    ? "Advance"
                    : "Settled"}
                </span>
                <span
                  className={`font-bold ${
                    ledger.closingBalance > 0
                      ? "text-red-600"
                      : ledger.closingBalance < 0
                      ? "text-green-700"
                      : ""
                  }`}
                >
                  {formatMoney(Math.abs(ledger.closingBalance))}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
