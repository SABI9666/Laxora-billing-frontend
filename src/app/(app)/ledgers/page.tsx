"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import ShareMenu from "@/components/ShareMenu";
import LedgerItems, {
  LedgerBills,
  LedgerKind,
  type LedgerBill,
  type LedgerItem,
} from "@/components/LedgerItems";

type Row = {
  id: string;
  name: string;
  phone?: string | null;
  billed: number;
  paid: number;
  balance: number;
};
type Ledger = {
  party: { id: string; name: string; type: string; phone?: string | null; openingBalance: number };
  closingBalance: number;
  // Where each bill stands after additions, returns, refunds and receipts.
  bills?: LedgerBill[];
  // Reconciliation footer — the same figures the party list is built from.
  totals?: {
    billed: number;
    received: number;
    refunded: number;
    returns: number;
    chargesAdjusted: number;
    chargesGiven: number;
  };
  ledger: {
    date: string;
    kind: string;
    ref: string;
    // Detail under the line, e.g. a charge's note and how it was settled.
    note?: string;
    // Goods behind the figure: bill lines, items added, returned or exchanged.
    items?: LedgerItem[];
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
  // Which party's ledger is loading / failed, so a click never goes silent.
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLedger(null);
    setError(null);
    const type = tab === "customers" ? "CUSTOMER" : "SUPPLIER";
    const r = await api<{ parties: Row[] }>(`/api/parties/summary?type=${type}`);
    setRows(r.parties);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function openLedger(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      setLedger(await api<Ledger>(`/api/parties/${id}/ledger`));
    } catch (e) {
      setLedger(null);
      setError(e instanceof Error ? e.message : "Could not load the ledger");
    } finally {
      setLoadingId(null);
    }
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Party balances */}
        <div className="card p-0 lg:col-span-1">
          <div className="border-b px-5 py-3 font-semibold">
            {isCustomer ? "Customers" : "Suppliers"}
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="table-th w-full !px-3">Name</th>
                  <th className="table-th !px-3 text-right">Billed</th>
                  <th className="table-th !px-3 text-right">Paid</th>
                  <th className="table-th !px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      ledger?.party.id === r.id ? "bg-indigo-50" : ""
                    }`}
                    onClick={() => openLedger(r.id)}
                  >
                    <td className="table-td w-full break-words !px-3 font-medium text-brand">
                      {r.name}
                      {loadingId === r.id && (
                        <span className="ml-2 text-xs font-normal text-gray-400">loading…</span>
                      )}
                    </td>
                    <td className="table-td whitespace-nowrap !px-3 text-right">{formatMoney(r.billed)}</td>
                    <td className="table-td whitespace-nowrap !px-3 text-right">{formatMoney(r.paid)}</td>
                    <td
                      className={`table-td whitespace-nowrap !px-3 text-right font-semibold ${
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
        <div className="card p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b px-5 py-3 font-semibold">
            <span>{ledger ? `${ledger.party.name} — Ledger` : "Select a name to view ledger"}</span>
            {ledger && (
              <span className="flex items-center gap-3">
                <ShareMenu
                  kind="ledger"
                  id={ledger.party.id}
                  phone={ledger.party.phone}
                  title={`Statement — ${ledger.party.name}`}
                  compact
                  message={[
                    `Statement of account for ${ledger.party.name}`,
                    ledger.closingBalance > 0.009
                      ? `${isCustomer ? "Balance due" : "Balance payable"}: ${formatMoney(ledger.closingBalance)}`
                      : ledger.closingBalance < -0.009
                      ? `Advance: ${formatMoney(Math.abs(ledger.closingBalance))}`
                      : "Account settled — thank you!",
                  ].join("\n")}
                />
                <Link
                  href={`/parties/${ledger.party.id}/ledger`}
                  target="_blank"
                  className="text-sm font-medium text-brand hover:underline"
                >
                  🖨️ Print / PDF
                </Link>
              </span>
            )}
          </div>
          {!ledger && (
            <div className="px-5 py-6 text-sm text-gray-400">
              {loadingId
                ? "Loading ledger…"
                : error
                ? (
                    <span className="text-red-600">
                      Could not open the ledger: {error}
                      {error.toLowerCase().includes("createdat") &&
                        " — run prisma/invoice-item-created-at.sql on the database and redeploy the backend."}
                    </span>
                  )
                : "Click a name on the left to see every bill, item added, return, refund and payment."}
            </div>
          )}
          {ledger && (
            <>
              <div className="max-h-[36rem] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="table-th !px-2">Date</th>
                      <th className="table-th w-full !px-2">Particulars</th>
                      <th className="table-th whitespace-nowrap !px-2 text-right" title="Adds to what is owed">
                        Owed (+)
                      </th>
                      <th className="table-th whitespace-nowrap !px-2 text-right" title="Reduces what is owed">
                        Paid / Returned (−)
                      </th>
                      <th className="table-th !px-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="table-td !px-2 text-gray-400" colSpan={4}>
                        Opening balance
                      </td>
                      <td className="table-td !px-2 text-right">
                        {formatMoney(ledger.party.openingBalance)}
                      </td>
                    </tr>
                    {ledger.ledger.map((e, i) => (
                      <tr key={i}>
                        <td className="table-td whitespace-nowrap !px-2 align-top">{formatDate(e.date)}</td>
                        <td className="table-td w-full max-w-0 !px-2 align-top">
                          <LedgerKind kind={e.kind} refNo={e.ref} />
                          {e.note && (
                            <div className="mt-0.5 text-xs text-slate-500">{e.note}</div>
                          )}
                          <LedgerItems items={e.items} />
                        </td>
                        <td className="table-td whitespace-nowrap !px-2 text-right align-top">
                          {e.debit ? formatMoney(e.debit) : "—"}
                        </td>
                        <td className="table-td whitespace-nowrap !px-2 text-right align-top text-green-700">
                          {e.credit ? formatMoney(e.credit) : "—"}
                        </td>
                        <td className="table-td whitespace-nowrap !px-2 text-right align-top font-medium">
                          {formatMoney(e.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ledger.bills && ledger.bills.length > 0 && (
                <div className="border-t px-5 pb-3">
                  <LedgerBills bills={ledger.bills} isCustomer={isCustomer} compact />
                </div>
              )}
              {ledger.totals && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 border-t bg-slate-50 px-5 py-2 text-xs text-slate-600">
                  {Math.abs(ledger.party.openingBalance) > 0.009 && (
                    <span title="Balance carried in when this party was created — it is part of the closing balance below">
                      Opening{" "}
                      <b className="text-slate-800">
                        {formatMoney(ledger.party.openingBalance)}
                      </b>
                    </span>
                  )}
                  <span>
                    Bills <b className="text-slate-800">{formatMoney(ledger.totals.billed)}</b>
                  </span>
                  <span>
                    Received{" "}
                    <b className="text-green-700">{formatMoney(ledger.totals.received)}</b>
                  </span>
                  {ledger.totals.returns > 0 && (
                    <span>
                      Returns <b className="text-slate-800">{formatMoney(ledger.totals.returns)}</b>
                    </span>
                  )}
                  {ledger.totals.refunded > 0 && (
                    <span>
                      Refunded <b className="text-slate-800">{formatMoney(ledger.totals.refunded)}</b>
                    </span>
                  )}
                  {ledger.totals.chargesAdjusted > 0 && (
                    <span>
                      Charges adjusted{" "}
                      <b className="text-slate-800">
                        {formatMoney(ledger.totals.chargesAdjusted)}
                      </b>
                    </span>
                  )}
                  {ledger.totals.chargesGiven > 0 && (
                    <span title="Commission / charges given to this party out of the bill value — not a receipt">
                      Commission given{" "}
                      <b className="text-slate-800">{formatMoney(ledger.totals.chargesGiven)}</b>
                    </span>
                  )}
                </div>
              )}
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
