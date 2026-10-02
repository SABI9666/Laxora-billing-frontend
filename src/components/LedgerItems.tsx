"use client";

import { formatMoney, formatDate } from "@/lib/format";

export type LedgerItem = {
  description: string;
  quantity: number;
  unit?: string;
  taxRate?: number;
  rate: number;
  amount: number;
};

export type LedgerBill = {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  original: number;
  added: number;
  total: number;
  returned: number;
  net: number;
  received: number;
  refunded: number;
  chargesAdjusted: number;
  due: number;
  status: "PAID" | "PARTIAL" | "UNPAID" | "EXCESS";
};

const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, ""));

// The goods behind a ledger line — what was billed, added later, returned or
// taken in exchange — as a compact "qty × item @ rate = amount" list.
export default function LedgerItems({ items }: { items?: LedgerItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 border-l-2 border-slate-200 pl-2 text-xs text-slate-600 print:text-[10px]">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="min-w-0 flex-1 break-words">
            <span className="tabular-nums">
              {qty(it.quantity)}
              {it.unit ? ` ${it.unit}` : ""}
            </span>{" "}
            × {it.description}
            <span className="text-slate-400">
              {" "}
              @ {formatMoney(it.rate)}
              {it.taxRate != null && it.taxRate > 0 ? ` incl. ${qty(it.taxRate)}% GST` : ""}
            </span>
          </span>
          <span className="shrink-0 tabular-nums">{formatMoney(it.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

// Colour by what the entry is, so a statement can be scanned at a glance.
export function kindClass(kind: string): string {
  if (/Invoice$/.test(kind)) return "bg-slate-100 text-slate-800 print:bg-transparent";
  if (kind === "Items added") return "bg-blue-50 text-blue-800 print:bg-transparent";
  if (kind.startsWith("Exchange: replacement")) return "bg-violet-50 text-violet-800 print:bg-transparent";
  if (kind.startsWith("Exchange") || kind.startsWith("Sales Return"))
    return "bg-amber-50 text-amber-800 print:bg-transparent";
  if (/refund/i.test(kind)) return "bg-red-50 text-red-700 print:bg-transparent";
  if (kind.startsWith("Payment") || kind.startsWith("Exchange difference"))
    return "bg-green-50 text-green-800 print:bg-transparent";
  return "bg-gray-50 text-gray-700 print:bg-transparent";
}

export function LedgerKind({ kind, refNo }: { kind: string; refNo?: string }) {
  return (
    <span>
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${kindClass(kind)}`}>
        {kind}
      </span>
      {refNo ? <span className="ml-1.5 text-slate-500">Bill {refNo}</span> : null}
    </span>
  );
}

const statusText: Record<LedgerBill["status"], { label: string; cls: string }> = {
  PAID: { label: "Paid", cls: "text-green-700" },
  PARTIAL: { label: "Part paid", cls: "text-amber-700" },
  UNPAID: { label: "Unpaid", cls: "text-red-600" },
  EXCESS: { label: "Excess paid", cls: "text-blue-700" },
};

// Bill-wise summary: where every bill stands after additions, returns,
// refunds and receipts. Columns nobody used are left out.
export function LedgerBills({
  bills,
  isCustomer,
  compact = false,
}: {
  bills?: LedgerBill[];
  isCustomer: boolean;
  // Narrow pane: drop the date and the billed/added split so due and status stay visible.
  compact?: boolean;
}) {
  if (!bills || bills.length === 0) return null;
  const any = (k: keyof LedgerBill) => bills.some((b) => Number(b[k]) > 0.009);
  const showAdded = !compact && any("added");
  const showDate = !compact;
  const showReturned = any("returned");
  const showRefunded = any("refunded");
  const showCharges = any("chargesAdjusted");
  const sum = (k: keyof LedgerBill) => bills.reduce((s, b) => s + Number(b[k]), 0);
  const cell = "whitespace-nowrap py-1 pr-2 text-right tabular-nums";
  return (
    <div className="mt-3">
      <p className="border-b border-gray-800 pb-1 text-xs font-bold uppercase tracking-wide">
        Bill-wise summary
      </p>
      <div className="overflow-x-auto">
        <table className="mt-1 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-300 text-left uppercase text-gray-500">
              <th className="py-1 pr-2">Bill</th>
              {showDate && <th className="py-1 pr-2">Date</th>}
              {showAdded && <th className={cell}>Billed</th>}
              {showAdded && <th className={cell}>Added</th>}
              <th className={cell}>Bill value</th>
              {showReturned && <th className={cell}>Returned</th>}
              {showReturned && <th className={cell}>Net</th>}
              <th className={cell}>{isCustomer ? "Received" : "Paid"}</th>
              {showCharges && <th className={cell}>Charges adj.</th>}
              {showRefunded && <th className={cell}>Refunded</th>}
              <th className={cell}>Due</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.invoiceId} className="border-b border-gray-100">
                <td className="whitespace-nowrap py-1 pr-2 font-medium">{b.invoiceNumber}</td>
                {showDate && <td className="whitespace-nowrap py-1 pr-2">{formatDate(b.date)}</td>}
                {showAdded && <td className={cell}>{formatMoney(b.original)}</td>}
                {showAdded && <td className={cell}>{b.added > 0.009 ? `+ ${formatMoney(b.added)}` : "—"}</td>}
                <td className={cell}>{formatMoney(b.total)}</td>
                {showReturned && (
                  <td className={cell}>{b.returned > 0.009 ? `− ${formatMoney(b.returned)}` : "—"}</td>
                )}
                {showReturned && <td className={`${cell} font-medium`}>{formatMoney(b.net)}</td>}
                <td className={cell}>{formatMoney(b.received)}</td>
                {showCharges && (
                  <td className={cell}>{b.chargesAdjusted > 0.009 ? formatMoney(b.chargesAdjusted) : "—"}</td>
                )}
                {showRefunded && (
                  <td className={cell}>{b.refunded > 0.009 ? `+ ${formatMoney(b.refunded)}` : "—"}</td>
                )}
                <td className={`${cell} font-semibold ${b.due > 0.009 ? "text-red-600" : ""}`}>
                  {formatMoney(Math.abs(b.due))}
                </td>
                <td className={`py-1 font-semibold ${statusText[b.status].cls}`}>
                  {statusText[b.status].label}
                </td>
              </tr>
            ))}
            <tr className="border-t border-gray-800 font-bold">
              <td className="py-1 pr-2" colSpan={showDate ? 2 : 1}>
                Total
              </td>
              {showAdded && <td className={cell}>{formatMoney(sum("original"))}</td>}
              {showAdded && <td className={cell}>{formatMoney(sum("added"))}</td>}
              <td className={cell}>{formatMoney(sum("total"))}</td>
              {showReturned && <td className={cell}>{formatMoney(sum("returned"))}</td>}
              {showReturned && <td className={cell}>{formatMoney(sum("net"))}</td>}
              <td className={cell}>{formatMoney(sum("received"))}</td>
              {showCharges && <td className={cell}>{formatMoney(sum("chargesAdjusted"))}</td>}
              {showRefunded && <td className={cell}>{formatMoney(sum("refunded"))}</td>}
              <td className={`${cell} ${sum("due") > 0.009 ? "text-red-600" : ""}`}>
                {formatMoney(sum("due"))}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[10px] text-gray-500">
        Net = bill value less returns. Due = net less {isCustomer ? "received" : "paid"}
        {showCharges ? " and charges adjusted" : ""}
        {showRefunded ? ", plus any money refunded back" : ""}.
      </p>
    </div>
  );
}

// Shop-side profit statement per sale bill — internal only, never on the
// shared or printed statement. Reads top to bottom the way the bill played
// out: bill value and its changes, what was collected, the profit earned on
// that, the expenses paid out of it (commission first), and the cash book.
export type LedgerProfitExpense = {
  date: string;
  category: string;
  note: string | null;
  amount: number;
  method: string | null;
};
export type LedgerProfitRow = {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  status: LedgerBill["status"];
  original: number;
  added: number;
  returned: number;
  netValue: number;
  received: number;
  balance: number;
  paidPercent: number;
  sales: number;
  cost: number;
  grossProfit: number;
  earnedProfit: number;
  commission: number;
  otherCharges: number;
  expenses: LedgerProfitExpense[];
  netProfit: number;
  cashIn: number;
  cashOut: number;
  netCash: number;
};
export type LedgerProfitTotals = Omit<
  LedgerProfitRow,
  "invoiceId" | "invoiceNumber" | "date" | "status" | "expenses"
>;
export type LedgerProfit = {
  bills: LedgerProfitRow[];
  totals: LedgerProfitTotals;
};

const money = (n: number) => (n < -0.009 ? `(${formatMoney(-n)})` : formatMoney(n));
const tone = (n: number) => (n < -0.009 ? "text-red-600" : n > 0.009 ? "text-green-700" : "");

function Line({
  label,
  value,
  sub,
  strong,
  cls = "",
  indent,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  strong?: boolean;
  cls?: string;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-0.5 ${
        strong ? "border-t border-gray-300 pt-1 font-semibold" : ""
      } ${indent ? "pl-3 text-gray-600" : ""}`}
    >
      <span className="min-w-0">
        {label}
        {sub && <span className="ml-1 text-[10px] font-normal text-gray-400">{sub}</span>}
      </span>
      <span className={`whitespace-nowrap tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">{title}</p>
      {children}
    </div>
  );
}

function ResultBadge({ n }: { n: number }) {
  const loss = n < -0.009;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
        loss ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
      }`}
    >
      {loss ? "Loss" : "Profit"}
    </span>
  );
}

const statusLabel: Record<LedgerBill["status"], string> = {
  PAID: "Fully paid",
  PARTIAL: "Part paid",
  UNPAID: "Unpaid",
  EXCESS: "Paid in excess",
};

// One bill, or the all-bills total when `row` has no invoice number.
function ProfitStatement({
  row,
  title,
  expenses,
}: {
  row: LedgerProfitTotals;
  title: React.ReactNode;
  expenses?: LedgerProfitExpense[];
}) {
  const full = row.paidPercent >= 99.995;
  const earnedLabel = full
    ? "Profit earned (bill fully collected)"
    : `Profit earned on amount received (${row.paidPercent.toFixed(1)}%)`;
  return (
    <div className="rounded-lg border border-gray-200 p-3 text-[11px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold text-gray-800">{title}</div>
        <ResultBadge n={row.netProfit} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Section title="1 · Bill & collection">
          <Line label="Invoice value" value={formatMoney(row.original)} />
          {row.added > 0.009 && <Line label="+ Items added" value={formatMoney(row.added)} indent />}
          {row.returned > 0.009 && (
            <Line label="− Goods returned" value={formatMoney(row.returned)} indent />
          )}
          <Line label="Net bill value" value={formatMoney(row.netValue)} strong />
          <Line
            label="Received"
            sub={`${row.paidPercent.toFixed(1)}%`}
            value={formatMoney(row.received)}
            cls="text-green-700"
          />
          <Line
            label="Balance due"
            value={formatMoney(row.balance)}
            cls={row.balance > 0.009 ? "text-red-600" : ""}
            strong
          />
        </Section>

        <Section title="2 · Profit">
          <Line label="Sales" sub="ex-GST, after returns" value={formatMoney(row.sales)} />
          <Line label="− Cost of goods" value={formatMoney(row.cost)} indent />
          <Line label="Profit on full bill" value={money(row.grossProfit)} strong />
          <Line label={earnedLabel} value={money(row.earnedProfit)} cls={tone(row.earnedProfit)} />
          {expenses
            ? expenses.map((x, i) => (
                <Line
                  key={i}
                  indent
                  label={`− ${x.category}`}
                  sub={[x.method ? `via ${x.method.toLowerCase()}` : "adjusted on bill", x.note]
                    .filter(Boolean)
                    .join(" · ")}
                  value={formatMoney(x.amount)}
                />
              ))
            : (
              <>
                {row.commission > 0.009 && (
                  <Line indent label="− Commission" value={formatMoney(row.commission)} />
                )}
                {row.otherCharges > 0.009 && (
                  <Line indent label="− Other expenses" value={formatMoney(row.otherCharges)} />
                )}
              </>
            )}
          {row.commission + row.otherCharges < 0.009 && (
            <Line indent label="− Commission / expenses" value="—" />
          )}
          <Line
            label={row.netProfit < -0.009 ? "Net loss" : "Net profit"}
            value={money(row.netProfit)}
            cls={`text-[12px] ${tone(row.netProfit)}`}
            strong
          />
          {!full && row.balance > 0.009 && (
            <p className="mt-0.5 text-[10px] text-gray-400">
              {formatMoney(row.grossProfit - row.earnedProfit)} more profit is earned once the
              balance is collected.
            </p>
          )}
        </Section>

        <Section title="3 · Cash book effect">
          <Line label="+ Collected from customer" value={formatMoney(row.cashIn)} />
          <Line label="− Commission / expenses paid out" value={formatMoney(row.cashOut)} indent />
          <Line label={expenses ? "Net cash from this bill" : "Net cash from these bills"} value={money(row.netCash)} cls={tone(row.netCash)} strong />
          <p className="mt-0.5 text-[10px] text-gray-400">
            Collections add to cash / bank; commission and expenses paid via cash or bank come
            out of it. Expenses adjusted on the bill move no cash.
          </p>
        </Section>
      </div>
    </div>
  );
}

export function LedgerProfitSummary({ profit }: { profit?: LedgerProfit | null }) {
  if (!profit || profit.bills.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="flex items-baseline justify-between border-b border-gray-800 pb-1 text-xs font-bold uppercase tracking-wide">
        <span>Profit statement</span>
        <span className="text-[10px] font-normal normal-case text-gray-400">
          internal — not on the shared / printed statement
        </span>
      </p>
      <div className="mt-2 space-y-2">
        {profit.bills.map((b) => (
          <ProfitStatement
            key={b.invoiceId}
            row={b}
            expenses={b.expenses}
            title={
              <>
                Bill {b.invoiceNumber}
                <span className="ml-2 font-normal text-gray-400">
                  {formatDate(b.date)} · {statusLabel[b.status]}
                </span>
              </>
            }
          />
        ))}
        {profit.bills.length > 1 && (
          <ProfitStatement row={profit.totals} title={`All bills (${profit.bills.length})`} />
        )}
      </div>
      <p className="mt-1 text-[10px] text-gray-500">
        Profit is counted in proportion to what has been collected; commission and other
        expenses are deducted in full as they are paid. Figures in brackets are a loss.
      </p>
    </div>
  );
}
