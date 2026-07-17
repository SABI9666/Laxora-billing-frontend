"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type ReturnRow = {
  id: string;
  totalAmount: string;
  refundMethod?: string | null;
  reason?: string | null;
  createdAt: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  type: "SALE" | "PURCHASE";
  status: string;
  total: string;
  amountPaid: string;
  invoiceDate: string;
  party: { id?: string; name: string };
  profit?: number | null;
};

const DAY = 86400000;
const OVERDUE_DAYS = 10;
const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / DAY);
type Line = {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  returnedQty?: string;
};
const remainingQty = (l: Line) => Number(l.quantity) - Number(l.returnedQty ?? 0);

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [type, setType] = useState<"" | "SALE" | "PURCHASE">("");
  const [search, setSearch] = useState("");

  // Return modal state
  const [returnInv, setReturnInv] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("");
  const [existingReturns, setExistingReturns] = useState<ReturnRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Quick "mark received" modal.
  const [payInv, setPayInv] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  const [paySaving, setPaySaving] = useState(false);

  async function load() {
    const q = type ? `?type=${type}` : "";
    const r = await api<{ invoices: Invoice[] }>(`/api/invoices${q}`);
    setInvoices(r.invoices);
  }

  const dueOf = (inv: Invoice) => Number(inv.total) - Number(inv.amountPaid);
  const isOverdue = (inv: Invoice) =>
    inv.type === "SALE" && dueOf(inv) > 0.009 && daysSince(inv.invoiceDate) >= OVERDUE_DAYS;

  function openPay(inv: Invoice) {
    setPayInv(inv);
    setPayAmount(Math.round(dueOf(inv) * 100) / 100);
    setPayMethod("CASH");
    setError("");
  }
  async function recordPay(e: React.FormEvent) {
    e.preventDefault();
    if (!payInv) return;
    const amt = Number(payAmount);
    if (!(amt > 0)) return setError("Enter an amount.");
    setPaySaving(true);
    setError("");
    try {
      await api("/api/payments", {
        method: "POST",
        body: {
          partyId: payInv.party?.id,
          invoiceId: payInv.id,
          direction: payInv.type === "SALE" ? "IN" : "OUT",
          purpose: payInv.type === "SALE" ? "Customer Receipt" : "Supplier Payment",
          amount: amt,
          method: payMethod,
        },
      });
      setPayInv(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setPaySaving(false);
    }
  }
  useEffect(() => {
    load();
  }, [type]);

  async function remove(inv: Invoice) {
    if (
      !confirm(
        `Delete ${inv.invoiceNumber}? This will be sent to the admin for approval.`
      )
    )
      return;
    const r = await api<{ pending?: boolean; message?: string } | undefined>(
      `/api/invoices/${inv.id}`,
      { method: "DELETE" }
    );
    if (r?.pending) {
      setNotice(r.message ?? "Deletion sent to the admin for approval.");
    }
    await load();
  }

  async function loadReturns(invoiceId: string) {
    try {
      const r = await api<{ returns: ReturnRow[] }>(`/api/invoices/${invoiceId}/returns`);
      setExistingReturns(r.returns);
    } catch {
      setExistingReturns([]);
    }
  }

  async function openReturn(inv: Invoice) {
    setError("");
    setReason("");
    setRetQty({});
    setRefundMethod("");
    setExistingReturns([]);
    setReturnInv(inv);
    const r = await api<{ invoice: { items: Line[] } }>(`/api/invoices/${inv.id}`);
    // Only lines with quantity still left to return.
    setLines(r.invoice.items.filter((l) => remainingQty(l) > 0.0001));
    loadReturns(inv.id);
  }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnInv) return;
    const items = Object.entries(retQty)
      .filter(([, q]) => q > 0)
      .map(([invoiceItemId, quantity]) => ({ invoiceItemId, quantity }));
    if (items.length === 0) {
      setError("Enter a return quantity for at least one item");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api(`/api/invoices/${returnInv.id}/return`, {
        method: "POST",
        body: { items, reason: reason || undefined, refundMethod: refundMethod || undefined },
      });
      setReturnInv(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record return");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReturn(rid: string) {
    if (!returnInv) return;
    const why = prompt(
      "Report this return as wrong? It will be sent to the admin for approval, and only removed once they approve.\n\nReason (optional):",
      ""
    );
    if (why === null) return; // cancelled
    try {
      const r = await api<{ pending?: boolean; message?: string }>(
        `/api/invoices/${returnInv.id}/return/${rid}`,
        { method: "DELETE", body: { reason: why || undefined } }
      );
      if (r?.pending) {
        alert(r.message || "Sent to the admin for approval.");
      }
      // Reload (a platform admin's removal takes effect immediately).
      const inv = await api<{ invoice: { items: Line[] } }>(`/api/invoices/${returnInv.id}`);
      setLines(inv.invoice.items.filter((l) => remainingQty(l) > 0.0001));
      await loadReturns(returnInv.id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not submit this request");
    }
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  // Overdue: unpaid sale bills past the 10-day mark.
  const overdueList = invoices.filter(isOverdue);
  const overdueTotal = overdueList.reduce((s, i) => s + dueOf(i), 0);

  // Live client-side search by customer/supplier name or bill number.
  const term = search.trim().toLowerCase();
  const visible = invoices.filter((inv) => {
    if (overdueOnly && !isOverdue(inv)) return false;
    if (
      term &&
      !inv.party?.name?.toLowerCase().includes(term) &&
      !inv.invoiceNumber.toLowerCase().includes(term)
    )
      return false;
    return true;
  });
  const sum = invoices.reduce(
    (acc, inv) => {
      const total = Number(inv.total);
      const paid = Number(inv.amountPaid);
      acc.total += total;
      acc.paid += paid;
      acc.due += Math.max(0, total - paid);
      if (inv.type === "SALE" && inv.profit != null) acc.profit += inv.profit;
      return acc;
    },
    { total: 0, paid: 0, due: 0, profit: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Invoices"
        action={
          <Link href="/invoices/new" className="btn-primary">
            + New Invoice
          </Link>
        }
      />

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-amber-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Overdue alert */}
      {overdueList.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-rose-800">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-lg">
              ⏰
            </span>
            <span>
              <b>{overdueList.length}</b> customer{overdueList.length === 1 ? "" : "s"} haven&apos;t
              paid after {OVERDUE_DAYS} days · <b>{formatMoney(overdueTotal)}</b> to collect
            </span>
          </div>
          <button
            onClick={() => setOverdueOnly((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              overdueOnly ? "bg-white text-rose-700 border border-rose-300" : "bg-rose-600 text-white"
            }`}
          >
            {overdueOnly ? "Show all bills" : "Show overdue only"}
          </button>
        </div>
      )}

      {/* Summary strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {type === "PURCHASE" ? "Purchases" : "Billed"}
          </p>
          <p className="mt-0.5 text-xl font-bold">{formatMoney(sum.total)}</p>
          <p className="text-xs text-slate-400">{invoices.length} bills</p>
        </div>
        <div className="card py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Received</p>
          <p className="mt-0.5 text-xl font-bold text-emerald-600">{formatMoney(sum.paid)}</p>
        </div>
        <div className="card py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pending</p>
          <p className={`mt-0.5 text-xl font-bold ${sum.due > 0 ? "text-rose-600" : "text-slate-500"}`}>
            {formatMoney(sum.due)}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Profit 🔒 <span className="normal-case">(sales)</span>
          </p>
          <p className={`mt-0.5 text-xl font-bold ${sum.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatMoney(sum.profit)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[
            { v: "", label: "All" },
            { v: "SALE", label: "Sales" },
            { v: "PURCHASE", label: "Purchases" },
          ].map((t) => (
            <button
              key={t.v}
              onClick={() => setType(t.v as any)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                type === t.v ? "bg-brand text-white" : "bg-white border border-gray-300 text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-80">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            className="input pl-9 pr-8"
            placeholder="Search by customer name or bill no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Clear"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">Bill</th>
                <th className="table-th">Party</th>
                <th className="table-th">Date</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Amount</th>
                <th className="table-th text-right">Due</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((inv) => {
                const due = round2(Number(inv.total) - Number(inv.amountPaid));
                const profit = inv.profit;
                const overdue = isOverdue(inv);
                const lateDays = daysSince(inv.invoiceDate);
                return (
                  <tr
                    key={inv.id}
                    className={`transition ${
                      overdue
                        ? "border-l-4 border-l-rose-500 bg-rose-50/60 hover:bg-rose-50"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className="table-td">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            inv.type === "PURCHASE"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-indigo-50 text-brand-700"
                          }`}
                          title={inv.type}
                        >
                          {inv.type === "PURCHASE" ? "P" : "S"}
                        </span>
                        <span className="font-semibold text-slate-800">{inv.invoiceNumber}</span>
                      </div>
                    </td>
                    <td className="table-td text-slate-700">{inv.party?.name}</td>
                    <td className="table-td text-slate-500">{formatDate(inv.invoiceDate)}</td>
                    <td className="table-td">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="table-td text-right">
                      <div className="font-semibold text-slate-900">{formatMoney(inv.total)}</div>
                      {inv.type === "SALE" && profit != null && (
                        <div
                          className={`text-xs font-semibold ${
                            profit > 0 ? "text-emerald-600" : profit < 0 ? "text-rose-600" : "text-slate-400"
                          }`}
                        >
                          {profit > 0 ? "▲" : profit < 0 ? "▼" : "•"} {formatMoney(Math.abs(profit))}{" "}
                          {profit >= 0 ? "profit" : "loss"}
                        </div>
                      )}
                    </td>
                    <td className="table-td text-right">
                      {due > 0.009 ? (
                        <>
                          <div className="font-semibold text-rose-600">{formatMoney(due)}</div>
                          {overdue && (
                            <div className="text-[11px] font-bold text-rose-500">
                              ⏰ {lateDays} days overdue
                            </div>
                          )}
                        </>
                      ) : due < -0.009 ? (
                        <span className="text-xs font-semibold text-emerald-600">
                          {formatMoney(Math.abs(due))} advance
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="table-td text-right">
                      {due > 0.009 && (
                        <button
                          onClick={() => openPay(inv)}
                          className="mr-3 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          ✓ Received
                        </button>
                      )}
                      <Link
                        href={`/invoices/${inv.id}/print`}
                        className="mr-3 text-brand hover:underline"
                      >
                        PDF
                      </Link>
                      <Link
                        href={`/invoices/${inv.id}/edit`}
                        className="mr-3 text-brand hover:underline"
                      >
                        Edit
                      </Link>
                      {inv.type === "SALE" && (
                        <button
                          onClick={() => openReturn(inv)}
                          className="mr-3 text-brand hover:underline"
                        >
                          Return
                        </button>
                      )}
                      <button onClick={() => remove(inv)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={7}>
                    {invoices.length === 0
                      ? "No invoices yet."
                      : overdueOnly
                      ? "No overdue payments — all caught up! 🎉"
                      : `No bills match “${search}”.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {returnInv && (
        <Modal
          title={`Return items — ${returnInv.invoiceNumber}`}
          onClose={() => setReturnInv(null)}
        >
          <form onSubmit={submitReturn} className="space-y-4">
            {error && <div className="text-sm text-red-600">{error}</div>}
            <p className="text-sm text-gray-500">
              Enter how many of each item the customer is returning. Stock goes back up and
              the bill/profit is adjusted automatically.
            </p>
            <div className="space-y-2">
              {lines.map((l) => {
                const remain = remainingQty(l);
                const alreadyRet = Number(l.returnedQty ?? 0);
                return (
                  <div key={l.id} className="flex items-center gap-2 border-b pb-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{l.description}</div>
                      <div className="text-xs text-gray-500">
                        Sold {Number(l.quantity)} @ {formatMoney(l.rate)}
                        {alreadyRet > 0 && (
                          <span className="ml-1 text-amber-600">· {alreadyRet} already returned</span>
                        )}
                        <span className="ml-1 font-medium text-slate-600">
                          · {remain} can be returned
                        </span>
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={remain}
                      step="0.001"
                      placeholder="0"
                      className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
                      value={retQty[l.id] ?? ""}
                      onChange={(e) =>
                        setRetQty({
                          ...retQty,
                          [l.id]: Math.min(Number(e.target.value), remain),
                        })
                      }
                    />
                  </div>
                );
              })}
              {lines.length === 0 && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  ✓ No products left to return on this bill — everything has already been returned.
                </p>
              )}
            </div>
            <div>
              <label className="label">Reason (optional)</label>
              <input
                className="input"
                placeholder="e.g. damaged / wrong item"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {lines.length > 0 && (
              <div>
                <label className="label">Refund the customer</label>
                <select
                  className="input"
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                >
                  <option value="">No cash refund — just credit their account</option>
                  <option value="CASH">Give cash back (reduces cash balance)</option>
                  <option value="BANK">Bank transfer back (reduces bank balance)</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  {refundMethod
                    ? `The refund will be taken out of this shop's ${
                        refundMethod === "BANK" ? "bank" : "cash"
                      } in the cash book.`
                    : "Use this only if you're physically handing money back. Otherwise it just lowers what they owe."}
                </p>
              </div>
            )}

            {existingReturns.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Returns already recorded on this bill
                </div>
                <div className="space-y-1.5">
                  {existingReturns.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="font-medium">{formatMoney(r.totalAmount)}</span>
                        <span className="text-gray-400"> · {formatDate(r.createdAt)}</span>
                        {r.refundMethod && (
                          <span className="text-gray-400"> · refunded {r.refundMethod}</span>
                        )}
                        {r.reason && <span className="text-gray-400"> · {r.reason}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteReturn(r.id)}
                        className="shrink-0 text-red-600 hover:underline"
                      >
                        Report wrong
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Reporting a wrong return sends it to the admin — it&apos;s only removed once
                  the admin approves.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setReturnInv(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving || lines.length === 0}>
                {saving ? "Processing…" : "Record Return"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {payInv && (
        <Modal
          title={`Payment ${payInv.type === "SALE" ? "received" : "paid"} — ${payInv.invoiceNumber}`}
          onClose={() => setPayInv(null)}
        >
          <form onSubmit={recordPay} className="space-y-4">
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-semibold">{payInv.party?.name}</span>
              <span className="ml-2 text-slate-500">
                Balance due {formatMoney(dueOf(payInv))}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Amount received</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setPayAmount(round2(dueOf(payInv)))}
                  className="mt-1 text-xs font-medium text-brand hover:underline"
                >
                  Full balance {formatMoney(dueOf(payInv))}
                </button>
              </div>
              <div>
                <label className="label">Received via</label>
                <select
                  className="input"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  {["CASH", "BANK", "UPI", "CARD", "CHEQUE", "OTHER"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setPayInv(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={paySaving}>
                {paySaving ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-emerald-50 text-emerald-700",
    PARTIAL: "bg-amber-50 text-amber-700",
    UNPAID: "bg-rose-50 text-rose-700",
  };
  const dot: Record<string, string> = {
    PAID: "bg-emerald-500",
    PARTIAL: "bg-amber-500",
    UNPAID: "bg-rose-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status] || "bg-slate-400"}`} />
      {status}
    </span>
  );
}
