"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";

type Activity = {
  productsAdded: number;
  productsEdited: number;
  bills: number;
  purchases: number;
  onlineOrders: number;
  payments: number;
  expenses: number;
  total: number;
};

type WeekDay = {
  day: string;
  label: string;
  sales: number;
  onlineSales: number;
  billCount: number;
  activity: Activity;
};

type PeriodFigures = {
  sales: number;
  bills: number;
  netRevenue: number;
  cogs: number;
  expenses: number;
  profit: number;
};

type Overview = {
  today: PeriodFigures;
  month: PeriodFigures;
  pending: {
    toReceive: number;
    receivableBills: number;
    toPay: number;
    payableBills: number;
  };
  week: WeekDay[];
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

const ACTIVITY_ROWS: { key: keyof Activity; label: string; icon: string; chip: string }[] = [
  { key: "productsAdded", label: "Product Entries", icon: "📦", chip: "bg-indigo-50 text-indigo-700" },
  { key: "productsEdited", label: "Product Edits", icon: "✏️", chip: "bg-sky-50 text-sky-700" },
  { key: "bills", label: "Bills Made", icon: "🧾", chip: "bg-emerald-50 text-emerald-700" },
  { key: "purchases", label: "Purchase Entries", icon: "🛒", chip: "bg-amber-50 text-amber-700" },
  { key: "onlineOrders", label: "Online Orders", icon: "🌐", chip: "bg-violet-50 text-violet-700" },
  { key: "payments", label: "Payments Recorded", icon: "💰", chip: "bg-teal-50 text-teal-700" },
  { key: "expenses", label: "Expenses Recorded", icon: "💸", chip: "bg-rose-50 text-rose-700" },
];

export default function DashboardPage() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [stale, setStale] = useState(false);
  const [activityDay, setActivityDay] = useState<string | null>(null);
  // Stat-card period: this month (default), this quarter, or this FY.
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const periodLabel =
    period === "quarter" ? "This Quarter" : period === "year" ? "This Year (FY)" : "This Month";

  useEffect(() => {
    api<{ overview: Overview }>(`/api/dashboard/overview?period=${period}`)
      .then((r) => {
        setOv(r.overview);
        const last = r.overview.week[r.overview.week.length - 1];
        if (last) setActivityDay(last.day);
      })
      .catch(() => setStale(true));
  }, [period]);

  useEffect(() => {
    api<{ invoices: Invoice[] }>("/api/dashboard/recent-invoices").then((r) =>
      setRecent(r.invoices)
    );
  }, []);

  // IST greeting.
  const greeting = useMemo(() => {
    const h = (new Date().getUTCHours() + 5.5) % 24;
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date()),
    []
  );

  const week = ov?.week ?? [];
  const maxSales = Math.max(1, ...week.map((d) => d.sales));
  const bestDay = week.reduce<WeekDay | null>(
    (best, d) => (d.sales > (best?.sales ?? 0) ? d : best),
    null
  );
  const selected = week.find((d) => d.day === activityDay) ?? week[week.length - 1];
  const monthProfitUp = (ov?.month.profit ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* ===== Hero ===== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-violet-600 p-6 text-white shadow-lg sm:p-8">
        {/* soft decorative glows */}
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 right-40 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-indigo-100">
              {greeting} 👋 · {todayLabel}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {ov ? formatMoney(ov.today.sales) : "—"}
              <span className="ml-2 align-middle text-sm font-semibold text-indigo-100">
                sales today · {ov?.today.bills ?? 0} bills
              </span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                  (ov?.today.profit ?? 0) >= 0
                    ? "bg-emerald-400/20 text-emerald-100"
                    : "bg-rose-500/30 text-rose-100"
                }`}
              >
                {(ov?.today.profit ?? 0) >= 0 ? "▲" : "▼"} Today&apos;s profit{" "}
                {ov ? formatMoney(ov.today.profit) : "—"}
              </span>
              {ov != null && ov.lowStockCount > 0 && (
                <Link
                  href="/stock"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-3 py-1 text-xs font-bold text-amber-100 hover:bg-amber-400/40"
                >
                  ⚠ {ov.lowStockCount} low-stock item{ov.lowStockCount === 1 ? "" : "s"}
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/invoices/new"
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-indigo-50"
            >
              + New Invoice
            </Link>
            <Link
              href="/pos"
              className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
            >
              🛒 POS / Sell
            </Link>
            <Link
              href="/items"
              className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
            >
              📦 Add Product
            </Link>
          </div>
        </div>
      </div>

      {stale && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The new dashboard needs the latest backend — redeploy the billing backend (and run
          the pending SQL) to see live figures here.
        </div>
      )}

      {/* ===== Period selector: month / quarter / financial year ===== */}
      <div className="flex items-center justify-end gap-1 rounded-full">
        {(
          [
            ["month", "Monthly"],
            ["quarter", "Quarterly"],
            ["year", "Yearly (FY)"],
          ] as const
        ).map(([p, label]) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              period === p
                ? "bg-brand text-white shadow"
                : "bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ===== KPI row ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon="📈"
          iconBg="bg-indigo-50"
          label={`Sales · ${periodLabel}`}
          value={ov ? formatMoney(ov.month.sales) : "—"}
          sub={ov ? `${ov.month.bills} bills raised` : ""}
        />
        <KpiCard
          icon={monthProfitUp ? "💹" : "📉"}
          iconBg={monthProfitUp ? "bg-emerald-50" : "bg-rose-50"}
          label={monthProfitUp ? `Net Profit · ${periodLabel}` : `Net Loss · ${periodLabel}`}
          value={ov ? formatMoney(Math.abs(ov.month.profit)) : "—"}
          valueClass={monthProfitUp ? "text-emerald-600" : "text-rose-600"}
          sub={
            ov
              ? `after ${formatMoney(ov.month.cogs)} cost · ${formatMoney(ov.month.expenses)} expenses`
              : ""
          }
          trend={ov ? (monthProfitUp ? "up" : "down") : undefined}
        />
        <KpiCard
          icon="📥"
          iconBg="bg-amber-50"
          label="Pending · To Receive"
          value={ov ? formatMoney(ov.pending.toReceive) : "—"}
          valueClass="text-amber-600"
          sub={ov ? `${ov.pending.receivableBills} unpaid bill${ov.pending.receivableBills === 1 ? "" : "s"}` : ""}
          href="/ledgers"
        />
        <KpiCard
          icon="📤"
          iconBg="bg-rose-50"
          label="Pending · To Pay"
          value={ov ? formatMoney(ov.pending.toPay) : "—"}
          valueClass="text-rose-600"
          sub={ov ? `${ov.pending.payableBills} supplier bill${ov.pending.payableBills === 1 ? "" : "s"}` : ""}
          href="/ledgers"
        />
      </div>

      {/* ===== Chart + Daily activity ===== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Last 7 days sales — single-series bar chart */}
        <div className="card xl:col-span-3">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="font-bold text-slate-800">Sales · Last 7 Days</h2>
            {bestDay && bestDay.sales > 0 && (
              <span className="text-xs font-medium text-slate-400">
                best day {formatMoney(bestDay.sales)}
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-slate-400">
            Daily billed sales — hover a bar for details.
          </p>

          <div className="flex h-44 items-end gap-2 border-b border-slate-200 sm:gap-3">
            {week.map((d, i) => {
              const isToday = i === week.length - 1;
              const h = d.sales > 0 ? Math.max(6, Math.round((d.sales / maxSales) * 150)) : 0;
              const labelled = d.sales > 0 && (isToday || d.day === bestDay?.day);
              return (
                <div key={d.day} className="group relative flex flex-1 flex-col items-center justify-end">
                  {/* tooltip */}
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
                    <span className="font-semibold">{formatMoney(d.sales)}</span> · {d.billCount}{" "}
                    bill{d.billCount === 1 ? "" : "s"}
                    {d.onlineSales > 0 ? ` · online ${formatMoney(d.onlineSales)}` : ""}
                  </div>
                  {labelled && (
                    <span className="mb-1 text-[10px] font-bold text-slate-600">
                      {formatMoney(d.sales)}
                    </span>
                  )}
                  {h > 0 ? (
                    <div
                      className={`w-full max-w-[38px] rounded-t ${
                        isToday ? "bg-brand-700" : "bg-brand-500/85 group-hover:bg-brand-600"
                      } transition-colors`}
                      style={{ height: h }}
                    />
                  ) : (
                    <div className="h-[3px] w-full max-w-[38px] rounded bg-slate-100" />
                  )}
                </div>
              );
            })}
            {week.length === 0 && (
              <p className="w-full pb-6 text-center text-sm text-slate-300">No data yet.</p>
            )}
          </div>
          <div className="mt-2 flex gap-2 sm:gap-3">
            {week.map((d, i) => (
              <span
                key={d.day}
                className={`flex-1 text-center text-[11px] ${
                  i === week.length - 1 ? "font-bold text-brand-700" : "text-slate-400"
                }`}
              >
                {i === week.length - 1 ? "Today" : d.label}
              </span>
            ))}
          </div>
        </div>

        {/* Entries made per day */}
        <div className="card xl:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Entries in Software</h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
              {selected?.activity.total ?? 0} total
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-400">What was entered on each day.</p>

          {/* day selector */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {week.map((d, i) => (
              <button
                key={d.day}
                onClick={() => setActivityDay(d.day)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selected?.day === d.day
                    ? "bg-brand text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {i === week.length - 1 ? "Today" : d.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            {ACTIVITY_ROWS.map((row) => {
              const count = selected ? selected.activity[row.key] : 0;
              return (
                <div
                  key={row.key}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                    count > 0 ? "bg-slate-50" : "opacity-45"
                  }`}
                >
                  <span className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[15px] shadow-sm">
                      {row.icon}
                    </span>
                    {row.label}
                  </span>
                  <span
                    className={`min-w-[2rem] rounded-full px-2 py-0.5 text-center text-sm font-bold ${
                      count > 0 ? row.chip : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Recent invoices ===== */}
      <div className="card p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-800">Recent Invoices</h2>
          <Link href="/invoices" className="text-sm font-semibold text-brand hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">Bill</th>
                <th className="table-th">Party</th>
                <th className="table-th">Date</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((inv) => (
                <tr key={inv.id} className="transition hover:bg-slate-50/60">
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                          inv.type === "PURCHASE"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-indigo-50 text-brand-700"
                        }`}
                      >
                        {inv.type === "PURCHASE" ? "P" : "S"}
                      </span>
                      <span className="font-semibold text-slate-800">{inv.invoiceNumber}</span>
                    </div>
                  </td>
                  <td className="table-td">{inv.party?.name}</td>
                  <td className="table-td text-slate-500">{formatDate(inv.invoiceDate)}</td>
                  <td className="table-td">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="table-td text-right font-semibold">{formatMoney(inv.total)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td className="table-td text-slate-400" colSpan={5}>
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

function KpiCard({
  icon,
  iconBg,
  label,
  value,
  valueClass = "text-slate-900",
  sub,
  trend,
  href,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  trend?: "up" | "down";
  href?: string;
}) {
  const body = (
    <div className="card h-full transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${iconBg}`}>
          {icon}
        </span>
        {trend && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              trend === "up" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}
          >
            {trend === "up" ? "▲ Profit" : "▼ Loss"}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${valueClass}`}>{value}</p>
      {sub ? <p className="mt-1 truncate text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-emerald-50 text-emerald-700",
    PARTIAL: "bg-amber-50 text-amber-700",
    UNPAID: "bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
        styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}
