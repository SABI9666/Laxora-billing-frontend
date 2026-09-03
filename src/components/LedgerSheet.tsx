"use client";

import { formatMoney, formatDate } from "@/lib/format";
import LedgerItems, {
  LedgerBills,
  LedgerKind,
  type LedgerBill,
  type LedgerItem,
} from "@/components/LedgerItems";

export type Entry = {
  date: string;
  kind: string;
  ref: string;
  note?: string;
  items?: LedgerItem[];
  debit: number;
  credit: number;
  balance: number;
};
export type Ledger = {
  party: {
    id: string;
    name: string;
    type: string;
    phone?: string | null;
    gstin?: string | null;
    billingAddress?: string | null;
    openingBalance: number;
  };
  closingBalance: number;
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
  ledger: Entry[];
};
export type Business = {
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

// The printable statement of account. Used by the in-app print page and by
// the public share link.
export default function LedgerSheet({ data, business }: { data: Ledger; business: Business }) {
  const isCustomer = data.party.type === "CUSTOMER";
  const bal = data.closingBalance;
  return (
      <div className="sheet rounded-xl border border-gray-300 bg-white p-8 text-[13px] text-gray-900">
        <div className="border-b-2 border-gray-800 pb-3 text-center">
          <h1 className="text-2xl font-extrabold uppercase tracking-wide">{business.name}</h1>
          {business.address && <p className="mt-1">{business.address}</p>}
          <p>
            {business.phone && <>Ph: {business.phone}</>}
            {business.gstin && <> · GSTIN: {business.gstin}</>}
          </p>
        </div>

        <p className="py-2 text-center text-sm font-bold uppercase tracking-widest">
          Statement of Account
        </p>

        <div className="border-b border-gray-300 pb-3">
          <p className="text-xs font-semibold uppercase text-gray-500">
            {isCustomer ? "Customer" : "Supplier"}
          </p>
          <p className="text-base font-bold">{data.party.name}</p>
          {data.party.billingAddress && <p>{data.party.billingAddress}</p>}
          {data.party.phone && <p>Ph: {data.party.phone}</p>}
          {data.party.gstin && <p>GSTIN: {data.party.gstin}</p>}
        </div>

        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800 text-left text-xs uppercase">
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Particulars</th>
              <th className="py-2 pr-2 text-right">Owed (+)</th>
              <th className="py-2 pr-2 text-right">Paid / Returned (−)</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200 text-gray-500">
              <td className="py-1.5 pr-2" colSpan={4}>
                Opening balance
              </td>
              <td className="py-1.5 text-right">{formatMoney(data.party.openingBalance)}</td>
            </tr>
            {data.ledger.map((e, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="whitespace-nowrap py-1.5 pr-2 align-top">{formatDate(e.date)}</td>
                <td className="w-full max-w-0 py-1.5 pr-2">
                  <LedgerKind kind={e.kind} refNo={e.ref} />
                  {e.note && <div className="text-xs text-gray-500">{e.note}</div>}
                  <LedgerItems items={e.items} />
                </td>
                <td className="whitespace-nowrap py-1.5 pr-2 text-right align-top">{e.debit ? formatMoney(e.debit) : "—"}</td>
                <td className="whitespace-nowrap py-1.5 pr-2 text-right align-top">{e.credit ? formatMoney(e.credit) : "—"}</td>
                <td className="whitespace-nowrap py-1.5 text-right align-top font-medium">{formatMoney(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <LedgerBills bills={data.bills} isCustomer={isCustomer} />

        {data.totals && (
          <div className="mt-2 flex flex-wrap justify-end gap-x-5 gap-y-1 text-xs text-gray-600">
            <span>
              Bills <b>{formatMoney(data.totals.billed)}</b>
            </span>
            <span>
              Received <b>{formatMoney(data.totals.received)}</b>
            </span>
            {data.totals.returns > 0 && (
              <span>
                Returns <b>{formatMoney(data.totals.returns)}</b>
              </span>
            )}
            {data.totals.refunded > 0 && (
              <span>
                Refunded <b>{formatMoney(data.totals.refunded)}</b>
              </span>
            )}
            {data.totals.chargesAdjusted > 0 && (
              <span>
                Charges adjusted <b>{formatMoney(data.totals.chargesAdjusted)}</b>
              </span>
            )}
            {data.totals.chargesGiven > 0 && (
              <span>
                Commission given <b>{formatMoney(data.totals.chargesGiven)}</b>
              </span>
            )}
          </div>
        )}
        <div className="mt-3 flex justify-end border-t-2 border-gray-800 pt-2">
          <div className="w-72 text-right">
            <span className="text-sm font-bold">
              {bal > 0
                ? isCustomer
                  ? "Balance due from customer"
                  : "Balance payable to supplier"
                : bal < 0
                ? isCustomer
                  ? "Advance from customer"
                  : "Advance to supplier"
                : "Settled"}
            </span>
            <span
              className={`ml-3 text-lg font-extrabold ${
                bal > 0 ? "text-red-600" : bal < 0 ? "text-green-700" : ""
              }`}
            >
              {formatMoney(Math.abs(bal))}
            </span>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Generated by Laxora Billing · {formatDate(new Date())}
        </p>
      </div>
  );
}
