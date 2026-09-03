"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";

type Entry = {
  date: string;
  kind: string;
  ref: string;
  note?: string;
  debit: number;
  credit: number;
  balance: number;
};
type Ledger = {
  party: {
    name: string;
    type: string;
    phone?: string | null;
    gstin?: string | null;
    billingAddress?: string | null;
    openingBalance: number;
  };
  closingBalance: number;
  ledger: Entry[];
};
type Business = {
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export default function PartyLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Ledger | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    api<Ledger>(`/api/parties/${id}/ledger`).then(setData);
    api<{ business: Business }>("/api/business").then((r) => setBusiness(r.business));
  }, [id]);

  if (!data || !business) return <div className="p-8 text-gray-400">Loading statement…</div>;

  const isCustomer = data.party.type === "CUSTOMER";
  const bal = data.closingBalance;

  return (
    <div className="mx-auto max-w-3xl">
      <style>{`
        @media print {
          aside, .no-print { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .sheet { border: none !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="btn-secondary">
          ← Back
        </button>
        <button onClick={() => window.print()} className="btn-primary">
          🖨️ Print / Save as PDF
        </button>
      </div>

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
              <th className="py-2 pr-2 text-right">Billed</th>
              <th className="py-2 pr-2 text-right">Paid/Return</th>
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
                <td className="py-1.5 pr-2">{formatDate(e.date)}</td>
                <td className="py-1.5 pr-2">
                  {e.kind}
                  {e.ref ? ` · ${e.ref}` : ""}
                  {e.note && <div className="text-xs text-gray-500">{e.note}</div>}
                </td>
                <td className="py-1.5 pr-2 text-right">{e.debit ? formatMoney(e.debit) : "—"}</td>
                <td className="py-1.5 pr-2 text-right">{e.credit ? formatMoney(e.credit) : "—"}</td>
                <td className="py-1.5 text-right font-medium">{formatMoney(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>

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
    </div>
  );
}
