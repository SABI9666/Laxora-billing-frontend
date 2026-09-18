"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";

// Business trend — sales, purchases and profit side by side, by week or month.
//
// Everything is plotted in rupees on ONE axis: sales and purchases as grouped
// columns, profit as a line on top. A second y-scale would let the same pixel
// height mean two different amounts, so the three series share a scale and the
// reader can compare heights directly.

export type Bucket = "week" | "month";

export type TrendPeriod = {
  key: string; // "2026-09" for a month, the Monday's date for a week
  label: string; // "Sep" · "6 Oct"
  fullLabel: string; // "Sep 2026" · "6–12 Oct 2026"
  sales: number;
  purchases: number;
  netRevenue: number;
  serviceIncome: number;
  cogs: number;
  expenses: number;
  profit: number;
  saleBills: number;
  purchaseBills: number;
};

// Series colours are checked for colour-blind separation against each other
// and for contrast on the white card; profit (the lightest) therefore always
// carries a direct label and a table view, never colour alone.
const C = {
  sales: "#2a78d6",
  purchase: "#eb6834",
  profit: "#1baf7a",
  grid: "#e7e9ee",
  axis: "#94a3b8",
};

// Indian short money for axis ticks: ₹1.2L, ₹45K, ₹3.4Cr.
function compactMoney(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return `${sign}₹${Math.round(a)}`;
}

// Round a raw step up to 1/2/2.5/5/10 × a power of ten so ticks land on
// numbers a person would actually say out loud.
function niceStep(range: number, targetTicks: number): number {
  if (range <= 0) return 1;
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

// How far back each bucket can look. The first entry is the default.
const RANGES: Record<Bucket, { periods: number; label: string }[]> = {
  week: [
    { periods: 12, label: "12 weeks" },
    { periods: 26, label: "26 weeks" },
  ],
  month: [
    { periods: 12, label: "12 months" },
    { periods: 6, label: "6 months" },
  ],
};

export default function TrendChart() {
  const [rows, setRows] = useState<TrendPeriod[] | null>(null);
  const [bucket, setBucket] = useState<Bucket>("month");
  const [periods, setPeriods] = useState(RANGES.month[0].periods);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  // Weeks and months have different ranges, so switching bucket resets the
  // range to that bucket's default rather than carrying over a stale count.
  function switchBucket(next: Bucket) {
    setBucket(next);
    setPeriods(RANGES[next][0].periods);
    setHover(null);
  }

  const unit = bucket === "week" ? "week" : "month";

  useEffect(() => {
    setFailed(false);
    setRows(null);
    api<{ trend: TrendPeriod[] }>(`/api/dashboard/trend?bucket=${bucket}&periods=${periods}`)
      .then((r) => setRows(r.trend))
      .catch(() => setFailed(true));
  }, [bucket, periods]);

  const data = rows ?? [];
  const hasData = data.some((d) => d.sales || d.purchases || d.profit);

  // Totals strip above the plot.
  const totals = useMemo(() => {
    const sales = data.reduce((s, d) => s + d.sales, 0);
    const purchases = data.reduce((s, d) => s + d.purchases, 0);
    const profit = data.reduce((s, d) => s + d.profit, 0);
    const best = data.reduce<TrendPeriod | null>(
      (b, d) => (d.sales > (b?.sales ?? -Infinity) ? d : b),
      null
    );
    return {
      sales,
      purchases,
      profit,
      margin: sales > 0 ? (profit / sales) * 100 : 0,
      avgSales: data.length ? sales / data.length : 0,
      best,
    };
  }, [data]);

  // ---- geometry (a fixed viewBox that scales to the card's width) ----------
  const W = 880;
  const H = 320;
  const PAD = { top: 22, right: 58, bottom: 34, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const scale = useMemo(() => {
    const vals = data.flatMap((d) => [d.sales, d.purchases, d.profit]);
    const rawMax = Math.max(1, ...vals);
    const rawMin = Math.min(0, ...vals);
    const step = niceStep(rawMax - rawMin, 4);
    const top = Math.ceil(rawMax / step) * step;
    const bottom = Math.floor(rawMin / step) * step;
    const ticks: number[] = [];
    for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    const y = (v: number) => PAD.top + plotH - ((v - bottom) / (top - bottom || 1)) * plotH;
    return { top, bottom, ticks, y };
  }, [data, plotH]);

  const band = plotW / Math.max(1, data.length);
  // Columns stay thin — the leftover width in each month's band is deliberate
  // air, and the 2px gap between the pair is the surface doing the separating.
  const barW = Math.min(20, Math.max(6, (band * 0.62 - 2) / 2));
  const centre = (i: number) => PAD.left + band * (i + 0.5);
  const zeroY = scale.y(0);

  const profitPoints = data.map((d, i) => `${centre(i)},${scale.y(d.profit)}`).join(" ");
  const last = data.length - 1;

  // 26 weekly labels ("23 Mar") do not fit side by side, so show every Nth and
  // let the tooltip name the rest. Counting back from the newest period keeps
  // the current one — the one in bold — always labelled.
  const labelWidth = bucket === "week" ? 46 : 26;
  const labelStep = Math.max(1, Math.ceil(labelWidth / band));
  const showLabel = (i: number) => (last - i) % labelStep === 0;

  return (
    <div className="card">
      {/* ---- header: title, range + view controls ---- */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800">Sales · Purchase · Profit</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {bucket === "week"
              ? `Week by week (Mon–Sun), last ${periods} weeks`
              : `Month by month, last ${periods} months`}{" "}
            — all figures in ₹.
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
                onClick={() => switchBucket(b)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  bucket === b ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5">
            {RANGES[bucket].map((r) => (
              <button
                key={r.periods}
                onClick={() => setPeriods(r.periods)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  periods === r.periods
                    ? "bg-white text-slate-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {r.periods}
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
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  view === v ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- totals for the window ---- */}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Total label="Total sales" value={formatMoney(totals.sales)} dot={C.sales} />
        <Total label="Total purchase" value={formatMoney(totals.purchases)} dot={C.purchase} />
        <Total
          label="Total profit"
          value={formatMoney(totals.profit)}
          dot={C.profit}
          valueClass={totals.profit >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
        <Total
          label="Profit margin"
          value={`${totals.margin.toFixed(1)}%`}
          hint={totals.best ? `best ${unit} ${totals.best.fullLabel}` : undefined}
        />
      </div>

      {/* ---- legend (identity never rests on colour alone) ---- */}
      {view === "chart" && (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendKey color={C.sales} label="Sales" />
          <LegendKey color={C.purchase} label="Purchase" />
          <LegendKey color={C.profit} label="Profit" line />
        </div>
      )}

      {failed && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Monthly trend needs the latest backend — redeploy the billing backend to see this chart.
        </p>
      )}

      {!failed && rows === null && (
        <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />
      )}

      {!failed && rows !== null && !hasData && (
        <p className="py-16 text-center text-sm text-slate-400">
          No billing activity in the last {periods} {unit}s yet.
        </p>
      )}

      {/* ---- chart ---- */}
      {!failed && rows !== null && hasData && view === "chart" && (
        <div className="overflow-x-auto">
          <div className="relative min-w-[620px]">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
                 aria-label={`Sales, purchase and profit by ${unit} for the last ${periods} ${unit}s`}>
              {/* gridlines + y ticks */}
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

              {/* month bands — the hover target is the whole column, not the bar */}
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

              {/* grouped columns: sales | purchase */}
              {data.map((d, i) => {
                const cx = centre(i);
                return (
                  <g key={`bars-${d.key}`} className="pointer-events-none">
                    <Column x={cx - barW - 1} w={barW} value={d.sales} y={scale.y} zeroY={zeroY} fill={C.sales} />
                    <Column x={cx + 1} w={barW} value={d.purchases} y={scale.y} zeroY={zeroY} fill={C.purchase} />
                  </g>
                );
              })}

              {/* profit line + markers */}
              <polyline
                points={profitPoints}
                fill="none"
                stroke={C.profit}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="pointer-events-none"
              />
              {data.map((d, i) => (
                <circle
                  key={`pt-${d.key}`}
                  cx={centre(i)}
                  cy={scale.y(d.profit)}
                  r={hover === i ? 5.5 : 4}
                  fill={C.profit}
                  stroke="#ffffff"
                  strokeWidth={2}
                  className="pointer-events-none"
                />
              ))}

              {/* the one direct label: profit at the latest month */}
              {data[last] && (
                <text
                  x={centre(last) + 12}
                  y={scale.y(data[last].profit) + 4}
                  className="fill-slate-600"
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  {compactMoney(data[last].profit)}
                </text>
              )}

              {/* x labels */}
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

            {/* tooltip */}
            {hover !== null && data[hover] && (
              <div
                className="pointer-events-none absolute top-2 z-10 w-52 -translate-x-1/2 rounded-xl bg-slate-800 p-3 text-xs text-white shadow-xl"
                style={{
                  left: `${Math.min(88, Math.max(12, ((centre(hover) / W) * 100)))}%`,
                }}
              >
                <p className="mb-2 font-bold">{data[hover].fullLabel}</p>
                <TipRow color={C.sales} label="Sales" value={formatMoney(data[hover].sales)} />
                <TipRow color={C.purchase} label="Purchase" value={formatMoney(data[hover].purchases)} />
                <TipRow color={C.profit} label="Profit" value={formatMoney(data[hover].profit)} />
                <p className="mt-2 border-t border-white/15 pt-2 text-[11px] text-slate-300">
                  {data[hover].saleBills} sale bill{data[hover].saleBills === 1 ? "" : "s"} ·{" "}
                  {data[hover].sales > 0
                    ? `${((data[hover].profit / data[hover].sales) * 100).toFixed(1)}% margin`
                    : "no sales"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- table view: every value in text, for reading and copying ---- */}
      {!failed && rows !== null && hasData && view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">{bucket === "week" ? "Week" : "Month"}</th>
                <th className="table-th text-right">Sales</th>
                <th className="table-th text-right">Purchase</th>
                <th className="table-th text-right">Cost + expenses</th>
                <th className="table-th text-right">Profit</th>
                <th className="table-th text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...data].reverse().map((d) => (
                <tr key={d.key} className="transition hover:bg-slate-50/60">
                  <td className="table-td font-semibold text-slate-800">{d.fullLabel}</td>
                  <td className="table-td text-right tabular-nums">{formatMoney(d.sales)}</td>
                  <td className="table-td text-right tabular-nums">{formatMoney(d.purchases)}</td>
                  <td className="table-td text-right tabular-nums text-slate-500">
                    {formatMoney(d.cogs + d.expenses)}
                  </td>
                  <td
                    className={`table-td text-right font-semibold tabular-nums ${
                      d.profit >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatMoney(d.profit)}
                  </td>
                  <td className="table-td text-right tabular-nums text-slate-500">
                    {d.sales > 0 ? `${((d.profit / d.sales) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                <td className="table-td font-bold text-slate-800">Total</td>
                <td className="table-td text-right font-bold tabular-nums">
                  {formatMoney(totals.sales)}
                </td>
                <td className="table-td text-right font-bold tabular-nums">
                  {formatMoney(totals.purchases)}
                </td>
                <td className="table-td text-right tabular-nums text-slate-500">
                  {formatMoney(data.reduce((s, d) => s + d.cogs + d.expenses, 0))}
                </td>
                <td
                  className={`table-td text-right font-bold tabular-nums ${
                    totals.profit >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatMoney(totals.profit)}
                </td>
                <td className="table-td text-right font-bold tabular-nums text-slate-500">
                  {totals.margin.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// A single column: 4px rounded cap at the data end, square where it meets the
// baseline. Values sit on either side of zero, so the path is drawn explicitly
// rather than with a plain <rect rx>.
function Column({
  x,
  w,
  value,
  y,
  zeroY,
  fill,
}: {
  x: number;
  w: number;
  value: number;
  y: (v: number) => number;
  zeroY: number;
  fill: string;
}) {
  if (!value) return null;
  const vy = y(value);
  const h = Math.abs(vy - zeroY);
  if (h < 0.5) return null;
  const r = Math.min(4, w / 2, h);
  const up = value > 0;
  const d = up
    ? `M${x},${zeroY} L${x},${vy + r} Q${x},${vy} ${x + r},${vy} L${x + w - r},${vy} Q${x + w},${vy} ${x + w},${vy + r} L${x + w},${zeroY} Z`
    : `M${x},${zeroY} L${x},${vy - r} Q${x},${vy} ${x + r},${vy} L${x + w - r},${vy} Q${x + w},${vy} ${x + w},${vy - r} L${x + w},${zeroY} Z`;
  return <path d={d} fill={fill} />;
}

function LegendKey({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
      {line ? (
        <span className="flex h-3 w-4 items-center">
          <span className="h-[2px] w-4 rounded" style={{ background: color }} />
        </span>
      ) : (
        <span className="h-3 w-3 rounded-[3px]" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2 text-slate-300">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Total({
  label,
  value,
  dot,
  hint,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string;
  dot?: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />}
        <span className="truncate">{label}</span>
      </p>
      <p className={`mt-0.5 truncate text-base font-extrabold tracking-tight ${valueClass}`} title={value}>
        {value}
      </p>
      {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
