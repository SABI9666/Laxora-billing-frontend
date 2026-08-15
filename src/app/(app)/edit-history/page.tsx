"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

// One product edit: which fields changed (old → new), who, when and why.
type EditRecord = {
  id: string;
  itemId: string;
  itemName: string;
  changes: Record<string, unknown>;
  previous?: Record<string, unknown> | null;
  reason?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  requestedByName?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  salePrice: "Sale Price",
  mrp: "M.R.P.",
  purchasePrice: "Purchase Price",
  taxRate: "Tax %",
  stockQty: "Stock Qty",
  lowStockAlert: "Low Stock Alert",
  sku: "Product Code",
  barcode: "Barcode",
  brand: "Brand",
  wattage: "Wattage / Model",
  hsn: "HSN",
  unit: "Unit",
  categoryId: "Category",
  supplierId: "Supplier",
  description: "Description",
  imageUrl: "Image 1",
  imageUrl2: "Image 2",
  imageUrl3: "Image 3",
  publishOnline: "Show on website",
  isService: "Service item",
  purchaseBillUrl: "Purchase bill",
};
// The money fields shown in the dedicated price columns.
const PRICE_FIELDS: { key: string; label: string }[] = [
  { key: "salePrice", label: "Sale" },
  { key: "purchasePrice", label: "Purchase" },
  { key: "mrp", label: "M.R.P." },
];
const MONEY_FIELDS = new Set(PRICE_FIELDS.map((f) => f.key));
// Long/technical values (ids, image URLs) aren't readable as old → new text.
const SUMMARY_ONLY = new Set([
  "categoryId",
  "supplierId",
  "imageUrl",
  "imageUrl2",
  "imageUrl3",
  "purchaseBillUrl",
  "description",
]);

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Waiting approval", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Approved", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-700" },
};

function formatWhen(s: string) {
  const d = new Date(s);
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

function valueText(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (MONEY_FIELDS.has(field)) return formatMoney(Number(v));
  if (field === "taxRate") return `${Number(v)}%`;
  if (typeof v === "boolean") return v ? "On" : "Off";
  return String(v);
}

// "₹68 → ₹75 (+₹7 · +10.3%)" — the heart of the page.
function PriceChange({ label, oldV, newV }: { label: string; oldV: unknown; newV: unknown }) {
  const hasOld = oldV !== null && oldV !== undefined;
  const delta = hasOld ? Number(newV) - Number(oldV) : null;
  const pct =
    delta !== null && Number(oldV) > 0 ? Math.round((delta / Number(oldV)) * 1000) / 10 : null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap text-sm">
      <span className="inline-block w-[72px] shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-semibold text-slate-500">
        {label}
      </span>
      {hasOld ? (
        <>
          <span className="text-gray-400 line-through">{formatMoney(Number(oldV))}</span>
          <span className="text-gray-400">→</span>
          <span className="font-bold text-gray-900">{formatMoney(Number(newV))}</span>
          {delta !== null && delta !== 0 && (
            <span
              className={`text-xs font-semibold ${delta > 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {delta > 0 ? "▲ +" : "▼ −"}
              {formatMoney(Math.abs(delta))}
              {pct !== null ? ` · ${delta > 0 ? "+" : "−"}${Math.abs(pct)}%` : ""}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="font-bold text-gray-900">{formatMoney(Number(newV))}</span>
          <span className="text-xs text-gray-400">(first recorded price)</span>
        </>
      )}
    </div>
  );
}

export default function EditHistoryPage() {
  const [records, setRecords] = useState<EditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filters (applied on the server so 1000s of edits stay fast).
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [priceOnly, setPriceOnly] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        q.set("page", String(p));
        if (search.trim()) q.set("search", search.trim());
        if (status !== "ALL") q.set("status", status);
        if (priceOnly) q.set("priceOnly", "1");
        if (from) q.set("from", from);
        if (to) q.set("to", to);
        const r = await api<{
          requests: EditRecord[];
          total: number;
          page: number;
          pageSize: number;
        }>(`/api/items/edit-history?${q.toString()}`);
        setRecords(r.requests);
        setTotal(r.total);
        setPage(r.page);
        setPageSize(r.pageSize);
        setExpanded(null);
      } finally {
        setLoading(false);
      }
    },
    [search, status, priceOnly, from, to]
  );

  // Debounce: refetch page 1 shortly after any filter changes.
  useEffect(() => {
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <div>
      <PageHeader title="Edit History" />
      <p className="mb-4 text-sm text-gray-500">
        Every product change in this shop — earlier price, updated price, who changed
        it, when, and why. Click a row for the full details.
      </p>

      {/* Filters */}
      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="label">Search product</label>
          <input
            className="input"
            placeholder="e.g. 10W bulb"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="ALL">All</option>
            <option value="PENDING">Waiting approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={priceOnly}
            onChange={(e) => setPriceOnly(e.target.checked)}
          />
          Price changes only
        </label>
      </div>

      <div className="card p-0">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <span className="font-semibold">Product Edits</span>
          <span className="text-xs text-gray-400">
            {loading ? "Loading…" : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString("en-IN")} edits`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Date &amp; Time</th>
                <th className="table-th">Product</th>
                <th className="table-th">Earlier → Updated Price</th>
                <th className="table-th">Other Changes</th>
                <th className="table-th">Edited By</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => {
                const badge = STATUS_BADGE[r.status] ?? {
                  label: r.status,
                  cls: "bg-gray-100 text-gray-600",
                };
                const when = formatWhen(r.createdAt);
                const priceChanges = PRICE_FIELDS.filter((f) => f.key in (r.changes ?? {}));
                if ("taxRate" in (r.changes ?? {})) {
                  // taxRate rendered with the price block, as text below.
                }
                const otherKeys = Object.keys(r.changes ?? {}).filter(
                  (k) => !MONEY_FIELDS.has(k)
                );
                const isOpen = expanded === r.id;
                return (
                  <>
                    <tr
                      key={r.id}
                      className="cursor-pointer align-top hover:bg-gray-50"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      <td className="table-td whitespace-nowrap">
                        <div className="font-medium">{when.date}</div>
                        <div className="text-xs text-gray-400">{when.time}</div>
                      </td>
                      <td className="table-td font-medium text-gray-800">{r.itemName}</td>
                      <td className="table-td">
                        {priceChanges.length === 0 ? (
                          <span className="text-xs text-gray-400">No price change</span>
                        ) : (
                          <div className="space-y-1">
                            {priceChanges.map((f) => (
                              <PriceChange
                                key={f.key}
                                label={f.label}
                                oldV={r.previous?.[f.key]}
                                newV={r.changes[f.key]}
                              />
                            ))}
                          </div>
                        )}
                        {"taxRate" in (r.changes ?? {}) && (
                          <div className="mt-1 text-xs text-gray-500">
                            Tax {valueText("taxRate", r.previous?.["taxRate"])} →{" "}
                            <b>{valueText("taxRate", r.changes["taxRate"])}</b>
                          </div>
                        )}
                      </td>
                      <td className="table-td text-xs text-gray-500">
                        {otherKeys.filter((k) => k !== "taxRate").length === 0
                          ? "—"
                          : otherKeys
                              .filter((k) => k !== "taxRate")
                              .map((k) => FIELD_LABELS[k] ?? k)
                              .join(", ")}
                      </td>
                      <td className="table-td text-sm">{r.requestedByName ?? "—"}</td>
                      <td className="table-td">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.id}-detail`} className="bg-slate-50/60">
                        <td className="table-td" colSpan={6}>
                          <div className="space-y-2 py-1">
                            {r.reason && (
                              <p className="text-sm italic text-gray-600">
                                Reason: {r.reason}
                              </p>
                            )}
                            <div className="space-y-1">
                              {Object.keys(r.changes ?? {}).map((k) => {
                                const label = FIELD_LABELS[k] ?? k;
                                if (SUMMARY_ONLY.has(k)) {
                                  return (
                                    <div key={k} className="text-sm text-gray-500">
                                      <span className="font-medium text-gray-700">{label}</span>{" "}
                                      updated
                                    </div>
                                  );
                                }
                                return (
                                  <div key={k} className="flex flex-wrap items-baseline gap-2 text-sm">
                                    <span className="w-36 shrink-0 font-medium text-gray-700">
                                      {label}
                                    </span>
                                    {r.previous ? (
                                      <>
                                        <span className="text-gray-400 line-through">
                                          {valueText(k, r.previous?.[k])}
                                        </span>
                                        <span className="text-gray-400">→</span>
                                        <span className="font-semibold text-gray-900">
                                          {valueText(k, r.changes[k])}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="font-semibold text-gray-900">
                                        {valueText(k, r.changes[k])}{" "}
                                        <span className="text-xs font-normal text-gray-400">
                                          (earlier value not recorded)
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-gray-400">
                              Edited {when.date}, {when.time}
                              {r.requestedByName ? ` by ${r.requestedByName}` : ""}
                              {r.reviewedAt && r.status !== "PENDING"
                                ? ` · ${r.status === "APPROVED" ? "approved" : "reviewed"} ${
                                    formatWhen(r.reviewedAt).date
                                  }, ${formatWhen(r.reviewedAt).time}`
                                : ""}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!loading && records.length === 0 && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={6}>
                    No product edits found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-5 py-3">
          <button
            className="btn-secondary text-sm"
            disabled={page <= 1 || loading}
            onClick={() => load(page - 1)}
          >
            ← Newer
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {pages}
          </span>
          <button
            className="btn-secondary text-sm"
            disabled={page >= pages || loading}
            onClick={() => load(page + 1)}
          >
            Older →
          </button>
        </div>
      </div>
    </div>
  );
}
