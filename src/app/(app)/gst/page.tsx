"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

type Row = {
  id: string;
  invoiceNumber: string;
  date: string;
  party?: string;
  gstin?: string | null;
  taxable: number;
  cgst?: number;
  sgst?: number;
  tax: number;
  total: number;
};
type RateRow = { rate: number; taxable: number; cgst: number; sgst: number; tax: number };
type Side = { rows: Row[]; rateSummary: RateRow[]; totalTaxable: number; totalTax: number };
type GstReport = {
  month: string;
  business?: { name: string; gstin?: string | null } | null;
  sales: Side;
  purchases: Side;
  creditNotes: { rows: Row[]; totalTaxable: number; totalTax: number };
  netPayable: number;
};

// Current month as YYYY-MM in local time.
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Builds and downloads a CSV file (Excel opens it directly).
function downloadCsv(filename: string, header: string[], lines: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...lines].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function GstFilingPage() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<GstReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(m: string) {
    setLoading(true);
    setError("");
    try {
      const r = await api<GstReport>(`/api/reports/gst?month=${m}`);
      setData(r);
    } catch {
      setError(
        "Could not load the GST report. Make sure the latest backend is deployed."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const gstin = data?.business?.gstin || "";

  function downloadSales() {
    if (!data) return;
    downloadCsv(
      `GSTR1-Sales-${data.month}.csv`,
      ["Invoice No", "Date", "Customer", "Customer GSTIN", "Type", "Taxable Value", "CGST", "SGST", "Total Tax", "Invoice Total"],
      data.sales.rows.map((r) => [
        r.invoiceNumber,
        new Date(r.date).toLocaleDateString("en-IN"),
        r.party ?? "",
        r.gstin ?? "",
        r.gstin ? "B2B" : "B2C",
        r.taxable,
        r.cgst ?? r.tax / 2,
        r.sgst ?? r.tax / 2,
        r.tax,
        r.total,
      ])
    );
  }
  function downloadPurchases() {
    if (!data) return;
    downloadCsv(
      `Purchases-InputTax-${data.month}.csv`,
      ["Bill No", "Date", "Supplier", "Supplier GSTIN", "Taxable Value", "CGST", "SGST", "Total Tax", "Bill Total"],
      data.purchases.rows.map((r) => [
        r.invoiceNumber,
        new Date(r.date).toLocaleDateString("en-IN"),
        r.party ?? "",
        r.gstin ?? "",
        r.taxable,
        r.cgst ?? r.tax / 2,
        r.sgst ?? r.tax / 2,
        r.tax,
        r.total,
      ])
    );
  }
  function downloadSummary() {
    if (!data) return;
    const lines: (string | number)[][] = [];
    lines.push(["OUTWARD (SALES)", "", "", "", ""]);
    data.sales.rateSummary.forEach((r) =>
      lines.push([`GST ${r.rate}%`, r.taxable, r.cgst, r.sgst, r.tax])
    );
    lines.push(["Total Sales", data.sales.totalTaxable, "", "", data.sales.totalTax]);
    lines.push(["Less: Credit Notes (Returns)", data.creditNotes.totalTaxable, "", "", data.creditNotes.totalTax]);
    lines.push(["INWARD (PURCHASES)", "", "", "", ""]);
    data.purchases.rateSummary.forEach((r) =>
      lines.push([`GST ${r.rate}%`, r.taxable, r.cgst, r.sgst, r.tax])
    );
    lines.push(["Total Purchases (ITC)", data.purchases.totalTaxable, "", "", data.purchases.totalTax]);
    lines.push(["NET GST PAYABLE", "", "", "", data.netPayable]);
    downloadCsv(
      `GST-Summary-${data.month}.csv`,
      ["Particulars", "Taxable Value", "CGST", "SGST", "Total Tax"],
      lines
    );
  }

  const RateTable = ({ side }: { side: Side }) => (
    <table className="w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="table-th">Rate</th>
          <th className="table-th text-right">Taxable Value</th>
          <th className="table-th text-right">CGST</th>
          <th className="table-th text-right">SGST</th>
          <th className="table-th text-right">Total Tax</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {side.rateSummary.map((r) => (
          <tr key={r.rate}>
            <td className="table-td font-medium">GST {r.rate}%</td>
            <td className="table-td text-right">{formatMoney(r.taxable)}</td>
            <td className="table-td text-right">{formatMoney(r.cgst)}</td>
            <td className="table-td text-right">{formatMoney(r.sgst)}</td>
            <td className="table-td text-right font-semibold">{formatMoney(r.tax)}</td>
          </tr>
        ))}
        {side.rateSummary.length === 0 && (
          <tr>
            <td className="table-td text-gray-400" colSpan={5}>
              No bills this month.
            </td>
          </tr>
        )}
        <tr className="bg-slate-50 font-bold">
          <td className="table-td">Total</td>
          <td className="table-td text-right">{formatMoney(side.totalTaxable)}</td>
          <td className="table-td text-right">{formatMoney(side.totalTax / 2)}</td>
          <td className="table-td text-right">{formatMoney(side.totalTax / 2)}</td>
          <td className="table-td text-right">{formatMoney(side.totalTax)}</td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div>
      <PageHeader title="GST Filing" />
      <p className="mb-4 text-sm text-gray-500">
        Month-wise GST summary for filing. Download the sales register (GSTR-1),
        purchase register (input tax credit) and the rate-wise summary as Excel-ready
        CSV files, and hand them to your accountant or upload on the GST portal.
        {gstin && (
          <span className="ml-1 font-medium text-gray-600">Your GSTIN: {gstin}</span>
        )}
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <label className="label">Filing month</label>
          <input
            type="month"
            className="input"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={downloadSummary} disabled={!data}>
            ⬇ GST Summary
          </button>
          <button className="btn-secondary" onClick={downloadSales} disabled={!data}>
            ⬇ Sales Register (GSTR-1)
          </button>
          <button className="btn-secondary" onClick={downloadPurchases} disabled={!data}>
            ⬇ Purchase Register (ITC)
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {data && !loading && (
        <>
          {/* Net position cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-gray-400">Output tax (sales)</p>
              <p className="mt-1 text-xl font-bold">{formatMoney(data.sales.totalTax)}</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-gray-400">Less: returns</p>
              <p className="mt-1 text-xl font-bold text-amber-600">
                − {formatMoney(data.creditNotes.totalTax)}
              </p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-gray-400">Input tax credit (purchases)</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">
                − {formatMoney(data.purchases.totalTax)}
              </p>
            </div>
            <div className="card ring-2 ring-brand/30">
              <p className="text-xs uppercase tracking-wide text-gray-400">Net GST payable</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  data.netPayable > 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {formatMoney(data.netPayable)}
              </p>
              {data.netPayable <= 0 && (
                <p className="text-xs text-gray-400">Credit carried forward</p>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-0">
              <div className="border-b border-gray-100 px-4 py-3 font-semibold">
                Outward — Sales ({data.sales.rows.length} bills)
              </div>
              <RateTable side={data.sales} />
            </div>
            <div className="card p-0">
              <div className="border-b border-gray-100 px-4 py-3 font-semibold">
                Inward — Purchases ({data.purchases.rows.length} bills)
              </div>
              <RateTable side={data.purchases} />
            </div>
          </div>

          {data.creditNotes.rows.length > 0 && (
            <div className="card mt-6 p-0">
              <div className="border-b border-gray-100 px-4 py-3 font-semibold">
                Credit Notes — Sales Returns (reduce output tax)
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th">Against Bill</th>
                    <th className="table-th">Date</th>
                    <th className="table-th text-right">Taxable</th>
                    <th className="table-th text-right">Tax</th>
                    <th className="table-th text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.creditNotes.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="table-td">{r.invoiceNumber || "—"}</td>
                      <td className="table-td">{formatDate(r.date)}</td>
                      <td className="table-td text-right">{formatMoney(r.taxable)}</td>
                      <td className="table-td text-right">{formatMoney(r.tax)}</td>
                      <td className="table-td text-right">{formatMoney(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400">
            Tax is shown split as CGST + SGST (intra-state sales). Figures are taken from
            your bills exactly as entered — verify with your accountant before filing.
          </p>
        </>
      )}
    </div>
  );
}
