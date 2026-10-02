"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  Bar,
  LegendKey,
  TipRow,
  Total,
  compactMoney,
  niceStep,
  type Bucket,
} from "@/components/TrendChart";

// Cash flow — the money that actually moved, by week or month: what came in
// from customers, what went out to suppliers, and what went out as commission
// and expenses, with the net left over as a line. One rupee axis for all of
// it, so bar heights compare directly.

type CashPeriod = {
  key: string;
  label: string;
  fullLabel: string;
  received: number;
  refunds: number;
  collected: number;
  supplierPaid: number;
  supplierRefunds: number;
  toSuppliers: number;
  commission: number;
  expenses: number;
  otherIncome: number;
  net: number;
};

// Categorical slots 1, 2, 7 (+ 3 for the line) of the reference palette,
// checked for colour-blind separation as a set. Commission rides on the
// expenses bar in a lighter step of the same hue — part of the money spent,
// not a rival category. The net line (lightest) always has a direct label
// and the table view.
const C = {
  collected: "#2a78d6",
  suppliers: "#eb6834",
  expenses: "#4a3aa7",
  commission: "#9085e9",
  net: "#1baf7a",
  grid: "#e7e9ee",
  axis: "#94a3b8",
};

const RANGES: Record<Bucket, number[]> = { week: [12, 26], month: [12, 6] };

export default function CashFlowChart() {
  const [rows, setRows] = useState<CashPeriod[] | null>(null);
  const [bucket, setBucket] = useState<Bucket>("month");
  const [periods, setPeriods] = useState(RANGES.month[0]);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const unit = bucket === "week" ? "week" : "month";

  useEffect(() => {
    setFailed(false);
    setRows(null);
    api<{ cashflow: CashPeriod[] }>(`/api/dashboard/cashflow?bucket=${bucket}&periods=${periods}`)
      .then((r) => setRows(r.cashflow))
      .catch(() => setFailed(true));
  }, [bucket, periods]);

  const data = rows ?? [];
  const hasData = data.some((d) => d.collected || d.toSuppliers || d.commission || d.expenses);
  const hasIncome = data.some((d) => d.otherIncome > 0);

  const totals = useMemo(() => {
    const sum = (k: keyof CashPeriod) => data.reduce((s, d) => s + Number(d[k]), 0);
    return {
      collected: sum("collected"),
      toSuppliers: sum("toSuppliers"),
      commission: sum("commission"),
      expenses: sum("expenses"),
      otherIncome: sum("otherIncome"),
      refunds: sum("refunds"),
      net: sum("net"),
    };
  }, [data]);

  // ---- geometry ----
  const W = 880;
  const H = 320;
  const PAD = { top: 22, right: 58, bottom: 34, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const scale = useMemo(() => {
    const vals = data.flatMap((d) => [
      Math.max(0, d.collected),
      Math.max(0, d.toSuppliers),
      d.commission + d.expenses,
      d.net,
    ]);
    const rawMax = Math.max(1, ...vals);
    const rawMin = Math.min(0, ...vals);
    const step = niceStep(rawMax - rawMin, 4);
    const top = Math.ceil(rawMax / step) * step;
    const bottom = Math.floor(rawMin / step) * step;
    const ticks: number[] = [];
    for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    const y = (v: number) => PAD.top + plotH - ((v - bottom) / (top - bottom || 1)) * plotH;
    return { ticks, y };
  }, [data, plotH]);

  const band = plotW / Math.max(1, data.length);
  // Three thin columns per period with 2px of surface between them.
  const barW = Math.min(16, Math.max(5, (band * 0.7 - 4) / 3));
  const centre = (i: number) => PAD.left + band * (i + 0.5);
  const zeroY = scale.y(0);
  const last = data.length - 1;
  const netPoints = data.map((d, i) => `${centre(i)},${scale.y(d.net)}`).join(" ");
  const labelStep = Math.max(1, Math.ceil((bucket === "week" ? 46 : 26) / band));
  const showLabel = (i: number) => (last - i) % labelStep === 0;

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold transition ${
      active ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800">Cash flow · Money in &amp; out</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {bucket === "week"
              ? `Week by week (Mon–Sun), last ${periods} weeks`
              : `Month by month, last ${periods} months`}{" "}
            — money actually received and paid, in ₹. Cash ↔ bank transfers are not counted.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5">
            {(
              [
                ["week", "Weekly"],
                ["month", "Monthly"],
              ] as const
            ).map(([b, label]) => (
              <button
                key={b}
                className={pill(bucket === b)}
                onClick={() => {
                  setBucket(b);
                  setPeriods(RANGES[b][0]);
                  setHover(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5">
            {RANGES[bucket].map((n) => (
              <button key={n} className={pill(periods === n)} onClick={() => setPeriods(n)}>
                {n}
                {bucket === "week" ? "W" : "M"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5">
            {(
              [
                ["chart", "Chart"],
                ["table", "Table"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} className={pill(view === v)} onClick={() => setView(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Total
          label="Collected from customers"
          value={formatMoney(totals.collected)}
          dot={C.collected}
          hint={totals.refunds > 0.009 ? `after ${formatMoney(totals.refunds)} refunds` : undefined}
        />
        <Total label="Paid to suppliers" value={formatMoney(totals.toSuppliers)} dot={C.suppliers} />
        <Total
          label="Commission + expenses"
          value={formatMoney(totals.commission + totals.expenses)}
          dot={C.expenses}
          hint={`commission ${formatMoney(totals.commission)}`}
        />
        <Total
          label="Net cash flow"
          value={formatMoney(totals.net)}
          dot={C.net}
          valueClass={totals.net >= 0 ? "text-emerald-600" : "text-rose-600"}
          hint={totals.net >= 0 ? "more came in than went out" : "more went out than came in"}
        />
      </div>

      {view === "chart" && (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendKey color={C.collected} label="Collected from customers" />
          <LegendKey color={C.suppliers} label="Paid to suppliers" />
          <LegendKey color={C.expenses} label="Expenses" />
          <LegendKey color={C.commission} label="Commission" />
          <LegendKey color={C.net} label="Net cash flow" line />
        </div>
      )}

      {failed && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Cash flow needs the latest backend — redeploy the billing backend to see this chart.
        </p>
      )}
      {!failed && rows === null && <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />}
      {!failed && rows !== null && !hasData && (
        <p className="py-16 text-center text-sm text-slate-400">
          No money in or out in the last {periods} {unit}s yet.
        </p>
      )}

      {!failed && rows !== null && hasData && view === "chart" && (
        <div className="overflow-x-auto">
          <div className="relative min-w-[620px]">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              role="img"
              aria-label={`Money collected, paid to suppliers and spent on expenses by ${unit}`}
            >
              {scale.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={scale.y(t)}
                    y2={scale.y(t)}
                    stroke={t === 0 ? C.axis : C.grid}
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 10}
                    y={scale.y(t) + 4}
                    textAnchor="end"
                    className="fill-slate-400"
                    style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}
                  >
                    {compactMoney(t)}
                  </text>
                </g>
              ))}

              {data.map((d, i) => (
                <rect
                  key={`band-${d.key}`}
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill={hover === i ? "#4f46e5" : "transparent"}
                  fillOpacity={hover === i ? 0.05 : 0}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}

              {data.map((d, i) => {
                const left = centre(i) - (barW * 3 + 4) / 2;
                return (
                  <g key={`bars-${d.key}`} className="pointer-events-none">
                    <Bar
                      x={left}
                      w={barW}
                      y={scale.y}
                      zeroY={zeroY}
                      segments={[{ value: d.collected, fill: C.collected }]}
                    />
                    <Bar
                      x={left + barW + 2}
                      w={barW}
                      y={scale.y}
                      zeroY={zeroY}
                      segments={[{ value: d.toSuppliers, fill: C.suppliers }]}
                    />
                    <Bar
                      x={left + 2 * (barW + 2)}
                      w={barW}
                      y={scale.y}
                      zeroY={zeroY}
                      segments={[
                        { value: d.expenses, fill: C.expenses },
                        { value: d.commission, fill: C.commission },
                      ]}
                    />
                  </g>
                );
              })}

              <polyline
                points={netPoints}
                fill="none"
                stroke={C.net}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="pointer-events-none"
              />
              {data.map((d, i) => (
                <circle
                  key={`pt-${d.key}`}
                  cx={centre(i)}
                  cy={scale.y(d.net)}
                  r={hover === i ? 5.5 : 4}
                  fill={C.net}
                  stroke="#ffffff"
                  strokeWidth={2}
                  className="pointer-events-none"
                />
              ))}
              {data[last] && (
                <text
                  x={centre(last) + 12}
                  y={scale.y(data[last].net) + 4}
                  className="fill-slate-600"
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  {compactMoney(data[last].net)}
                </text>
              )}

              {data.map((d, i) =>
                showLabel(i) || hover === i ? (
                  <text
                    key={`x-${d.key}`}
                    x={centre(i)}
                    y={H - 12}
                    textAnchor="middle"
                    className={hover === i || i === last ? "fill-slate-700" : "fill-slate-400"}
                    style={{ fontSize: 11, fontWeight: hover === i || i === last ? 700 : 400 }}
                  >
                    {d.label}
                  </text>
                ) : null
              )}
            </svg>

            {hover !== null && data[hover] && (
              <div
                className="pointer-events-none absolute top-2 z-10 w-64 -translate-x-1/2 rounded-xl bg-slate-800 p-3 text-xs text-white shadow-xl"
                style={{ left: `${Math.min(88, Math.max(12, (centre(hover) / W) * 100))}%` }}
              >
                <p className="mb-2 font-bold">{data[hover].fullLabel}</p>
                <TipRow
                  color={C.collected}
                  label="Collected from customers"
                  value={formatMoney(data[hover].collected)}
                />
                {data[hover].refunds > 0.009 && (
                  <p className="pl-4 text-[11px] text-slate-400">
                    after {formatMoney(data[hover].refunds)} refunded
                  </p>
                )}
                {data[hover].otherIncome > 0.009 && (
                  <TipRow color="#94a3b8" label="Other income" value={formatMoney(data[hover].otherIncome)} />
                )}
                <TipRow color={C.suppliers} label="Paid to suppliers" value={formatMoney(data[hover].toSuppliers)} />
                <TipRow color={C.expenses} label="Expenses" value={formatMoney(data[hover].expenses)} />
                <TipRow color={C.commission} label="Commission" value={formatMoney(data[hover].commission)} />
                <div className="mt-1 border-t border-white/15 pt-1">
                  <TipRow color={C.net} label="Net cash flow" value={formatMoney(data[hover].net)} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!failed && rows !== null && hasData && view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">{bucket === "week" ? "Week" : "Month"}</th>
                <th className="table-th text-right">Collected</th>
                {hasIncome && <th className="table-th text-right">Other income</th>}
                <th className="table-th text-right">To suppliers</th>
                <th className="table-th text-right">Commission</th>
                <th className="table-th text-right">Expenses</th>
                <th className="table-th text-right">Net cash flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...data].reverse().map((d) => (
                <tr key={d.key} className="transition hover:bg-slate-50/60">
                  <td className="table-td font-semibold text-slate-800">{d.fullLabel}</td>
                  <td className="table-td text-right tabular-nums">{formatMoney(d.collected)}</td>
                  {hasIncome && (
                    <td className="table-td text-right tabular-nums">{formatMoney(d.otherIncome)}</td>
                  )}
                  <td className="table-td text-right tabular-nums">{formatMoney(d.toSuppliers)}</td>
                  <td className="table-td text-right tabular-nums">{formatMoney(d.commission)}</td>
                  <td className="table-td text-right tabular-nums">{formatMoney(d.expenses)}</td>
                  <td
                    className={`table-td text-right font-semibold tabular-nums ${
                      d.net >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatMoney(d.net)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                <td className="table-td font-bold text-slate-800">Total</td>
                <td className="table-td text-right font-bold tabular-nums">{formatMoney(totals.collected)}</td>
                {hasIncome && (
                  <td className="table-td text-right font-bold tabular-nums">
                    {formatMoney(totals.otherIncome)}
                  </td>
                )}
                <td className="table-td text-right font-bold tabular-nums">{formatMoney(totals.toSuppliers)}</td>
                <td className="table-td text-right font-bold tabular-nums">{formatMoney(totals.commission)}</td>
                <td className="table-td text-right font-bold tabular-nums">{formatMoney(totals.expenses)}</td>
                <td
                  className={`table-td text-right font-bold tabular-nums ${
                    totals.net >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatMoney(totals.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
