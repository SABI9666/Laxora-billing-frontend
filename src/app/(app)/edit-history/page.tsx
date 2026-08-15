"use client";

import { useEffect, useMemo, useState } from "react";
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
const MONEY_FIELDS = new Set(["salePrice", "mrp", "purchasePrice"]);
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
  PENDING: { label: "Waiting for admin approval", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Approved", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-700" },
};

function formatWhen(s: string) {
  return new Date(s).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function valueText(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (MONEY_FIELDS.has(field)) return formatMoney(Number(v));
  if (field === "taxRate") return `${Number(v)}%`;
  if (typeof v === "boolean") return v ? "On" : "Off";
  return String(v);
}

export default function EditHistoryPage() {
  const [records, setRecords] = useState<EditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [priceOnly, setPriceOnly] = useState(false);

  useEffect(() => {
    api<{ requests: EditRecord[] }>("/api/items/edit-history")
      .then((r) => setRecords(r.requests))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (
        priceOnly &&
        !Object.keys(r.changes ?? {}).some((k) => MONEY_FIELDS.has(k) || k === "taxRate")
      )
        return false;
      if (term && !r.itemName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [records, search, status, priceOnly]);

  return (
    <div>
      <PageHeader title="Edit History" />
      <p className="mb-4 text-sm text-gray-500">
        Every product change made in this shop — what was edited, the old and new
        values, who changed it, when, and why. Price changes are highlighted.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input w-64"
          placeholder="Search product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-56"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="ALL">All statuses</option>
          <option value="PENDING">Waiting for approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={priceOnly}
            onChange={(e) => setPriceOnly(e.target.checked)}
          />
          Price / tax changes only
        </label>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="card text-center text-gray-400">
          No product edits found{search || status !== "ALL" || priceOnly ? " for this filter" : " yet"}.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const badge = STATUS_BADGE[r.status] ?? {
              label: r.status,
              cls: "bg-gray-100 text-gray-600",
            };
            const fields = Object.keys(r.changes ?? {});
            return (
              <div key={r.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-gray-800">{r.itemName}</span>
                    <span
                      className={`ml-3 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <div>
                      Edited {formatWhen(r.createdAt)}
                      {r.requestedByName ? ` · by ${r.requestedByName}` : ""}
                    </div>
                    {r.reviewedAt && r.status !== "PENDING" && (
                      <div>
                        {r.status === "APPROVED" ? "Approved" : "Reviewed"}{" "}
                        {formatWhen(r.reviewedAt)}
                      </div>
                    )}
                  </div>
                </div>

                {r.reason && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-gray-600">
                    Reason: {r.reason}
                  </p>
                )}

                <div className="mt-3 space-y-1">
                  {fields.map((k) => {
                    const label = FIELD_LABELS[k] ?? k;
                    const oldV = r.previous?.[k];
                    const newV = r.changes[k];
                    if (SUMMARY_ONLY.has(k)) {
                      return (
                        <div key={k} className="text-sm text-gray-500">
                          <span className="font-medium text-gray-700">{label}</span>{" "}
                          updated
                        </div>
                      );
                    }
                    const isMoney = MONEY_FIELDS.has(k);
                    const delta =
                      isMoney && r.previous && oldV != null
                        ? Number(newV) - Number(oldV)
                        : null;
                    return (
                      <div key={k} className="flex flex-wrap items-baseline gap-2 text-sm">
                        <span className="w-32 shrink-0 font-medium text-gray-700">
                          {label}
                        </span>
                        {r.previous ? (
                          <>
                            <span className="text-gray-400 line-through">
                              {valueText(k, oldV)}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="font-semibold text-gray-900">
                              {valueText(k, newV)}
                            </span>
                            {delta !== null && delta !== 0 && (
                              <span
                                className={`text-xs font-medium ${
                                  delta > 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                ({delta > 0 ? "+" : "−"}
                                {formatMoney(Math.abs(delta))})
                              </span>
                            )}
                          </>
                        ) : (
                          // Older edits (before history tracking) didn't store
                          // the previous value — show only what it was set to.
                          <span className="font-semibold text-gray-900">
                            set to {valueText(k, newV)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
