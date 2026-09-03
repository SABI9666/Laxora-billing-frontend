"use client";

import { formatMoney } from "@/lib/format";

export type LedgerItem = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, ""));

// The goods behind a ledger line — what was billed, added later, returned or
// taken in exchange — as a compact "qty × item @ rate = amount" list.
export default function LedgerItems({ items }: { items?: LedgerItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-slate-500 print:text-[10px]">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="min-w-0 flex-1 truncate">
            <span className="tabular-nums">{qty(it.quantity)}</span> × {it.description}
            <span className="text-slate-400"> @ {formatMoney(it.rate)}</span>
          </span>
          <span className="shrink-0 tabular-nums">{formatMoney(it.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
