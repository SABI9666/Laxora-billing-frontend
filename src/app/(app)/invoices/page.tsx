"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ItemPicker from "@/components/ItemPicker";

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
  taxRate?: string;
  returnedQty?: string;
};
const remainingQty = (l: Line) => Number(l.quantity) - Number(l.returnedQty ?? 0);
type CreditNote = {
  id: string;
  totalAmount: string;
  reason?: string | null;
  refundMethod?: string | null;
  createdAt: string;
};
// Product catalog entry for the "Add items to bill" picker.
type CatalogItem = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  salePrice: string;
  purchasePrice: string;
  taxRate: string;
  stockQty: string;
  isService: boolean;
};
type AddLine = { itemId: string; description: string; quantity: number; rate: number; taxRate: number };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [type, setType] = useState<"" | "SALE" | "PURCHASE">("");
  const [search, setSearch] = useState("");

  // Return modal state
  const [returnInv, setReturnInv] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  // How the customer is paid back for the returned goods. CASH/BANK records an
  // OUT voucher so the cash book drops; NONE only credits the customer ledger.
  const [refundMethod, setRefundMethod] = useState<"CASH" | "BANK" | "NONE">("CASH");
  // Returns already recorded against the open bill, so a wrong one can be undone.
  const [returnsList, setReturnsList] = useState<CreditNote[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Quick "mark received" modal.
  const [payInv, setPayInv] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  const [paySaving, setPaySaving] = useState(false);

  // "Add items to bill" modal — the customer takes more goods days later and
  // they go onto the same bill instead of a fresh one.
  const [addInv, setAddInv] = useState<Invoice | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [addLines, setAddLines] = useState<AddLine[]>([]);
  const [addInclusive, setAddInclusive] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const emptyAddLine = (): AddLine => ({
    itemId: "",
    description: "",
    quantity: 1,
    rate: 0,
    taxRate: 0,
  });
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  // Exchange inside the Return dialog: the customer returns goods AND takes
  // other products; the difference is collected, left as due, or refunded.
  const [exch, setExch] = useState(false);
  const [exchLines, setExchLines] = useState<AddLine[]>([]);
  const [exchInclusive, setExchInclusive] = useState(false);
  const [exchPay, setExchPay] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [exchPayMethod, setExchPayMethod] = useState("CASH");
  const [exchPayAmount, setExchPayAmount] = useState(0);
  const [exchRefund, setExchRefund] = useState<"ADJUST" | "CASH" | "BANK">("ADJUST");

  async function loadCatalog() {
    if (catalog.length > 0) return;
    try {
      const r = await api<{ items: CatalogItem[] }>("/api/items");
      setCatalog(r.items);
    } catch {
      /* picker just stays empty */
    }
  }

  function pickExchItem(index: number, itemId: string) {
    const it = catalog.find((c) => c.id === itemId);
    if (!it) return;
    setExchLines((ls) =>
      ls.map((l, i) =>
        i === index
          ? {
              itemId,
              description: it.name,
              quantity: l.quantity || 1,
              rate: Number(it.salePrice),
              taxRate: Number(it.taxRate),
            }
          : l
      )
    );
  }

  async function openAdd(inv: Invoice) {
    setAddInv(inv);
    setAddLines([emptyAddLine()]);
    setAddInclusive(false);
    setAddError("");
    await loadCatalog();
  }

  function pickAddItem(index: number, itemId: string) {
    const it = catalog.find((c) => c.id === itemId);
    if (!it || !addInv) return;
    setAddLines((ls) =>
      ls.map((l, i) =>
        i === index
          ? {
              itemId,
              description: it.name,
              quantity: l.quantity || 1,
              rate: Number(addInv.type === "SALE" ? it.salePrice : it.purchasePrice),
              taxRate: Number(it.taxRate),
            }
          : l
      )
    );
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addInv) return;
    const valid = addLines.filter((l) => l.description && l.quantity > 0);
    if (valid.length === 0) {
      setAddError("Pick at least one product with a quantity.");
      return;
    }
    setAddSaving(true);
    setAddError("");
    try {
      await api(`/api/invoices/${addInv.id}/add-items`, {
        method: "POST",
        body: {
          taxInclusive: addInclusive,
          items: valid.map((l) => ({
            itemId: l.itemId || undefined,
            description: l.description,
            quantity: Number(l.quantity),
            rate: Number(l.rate),
            taxRate: Number(l.taxRate),
          })),
        },
      });
      setNotice(`✅ Items added to ${addInv.invoiceNumber} — bill total and pending updated.`);
      setAddInv(null);
      await load();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Failed to add items");
    } finally {
      setAddSaving(false);
    }
  }

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

  // Refresh the return modal's item lines and recorded-returns list from the
  // server so both reflect the latest state after recording or deleting one.
  async function refreshReturnModal(invId: string) {
    const [r, rr] = await Promise.all([
      api<{ invoice: { items: Line[] } }>(`/api/invoices/${invId}`),
      api<{ returns: CreditNote[] }>(`/api/invoices/${invId}/returns`),
    ]);
    // Only lines with quantity still left to return.
    setLines(r.invoice.items.filter((l) => remainingQty(l) > 0.0001));
    setReturnsList(rr.returns);
  }

  async function openReturn(inv: Invoice) {
    setError("");
    setNotice("");
    setReason("");
    setRetQty({});
    setRefundMethod("CASH");
    setReturnsList([]);
    setLines([]);
    // Reset the exchange section.
    setExch(false);
    setExchLines([emptyAddLine()]);
    setExchInclusive(false);
    setExchPay("PAID");
    setExchPayMethod("CASH");
    setExchPayAmount(0);
    setExchRefund("ADJUST");
    setReturnInv(inv);
    await Promise.all([refreshReturnModal(inv.id), loadCatalog()]);
  }

  // Gross (incl GST) value of what's being returned / taken in exchange —
  // drives the live difference shown to the operator.
  const returnGross = lines.reduce(
    (s, l) =>
      s + (retQty[l.id] ?? 0) * Number(l.rate) * (1 + Number(l.taxRate ?? 0) / 100),
    0
  );
  const exchValid = exchLines.filter((l) => l.description && l.quantity > 0);
  const exchGross = exchValid.reduce((s, l) => {
    const net = exchInclusive ? l.rate / (1 + l.taxRate / 100) : l.rate;
    return s + l.quantity * net * (1 + l.taxRate / 100);
  }, 0);
  const exchDiff = r2(exchGross - returnGross);

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
    if (exch && exchValid.length === 0) {
      setError("Pick the product the customer is taking in exchange (or untick exchange).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // 1. The return itself. In exchange mode no cash is refunded here — the
      //    return value nets against the new goods; only the difference moves.
      await api(`/api/invoices/${returnInv.id}/return`, {
        method: "POST",
        body: {
          items,
          reason:
            (exch ? "Exchange" : "") + (reason ? (exch ? ": " : "") + reason : "") ||
            undefined,
          refundMethod: exch || refundMethod === "NONE" ? undefined : refundMethod,
        },
      });

      if (exch) {
        // 2. The replacement goods go onto the same bill (stock out, totals up).
        await api(`/api/invoices/${returnInv.id}/add-items`, {
          method: "POST",
          body: {
            taxInclusive: exchInclusive,
            items: exchValid.map((l) => ({
              itemId: l.itemId || undefined,
              description: l.description,
              quantity: Number(l.quantity),
              rate: Number(l.rate),
              taxRate: Number(l.taxRate),
            })),
          },
        });

        // 3. Settle the difference.
        if (exchDiff > 0.009) {
          const pay =
            exchPay === "PAID"
              ? exchDiff
              : exchPay === "PARTIAL"
              ? Math.min(r2(exchPayAmount), exchDiff)
              : 0;
          if (pay > 0.009) {
            await api("/api/payments", {
              method: "POST",
              body: {
                invoiceId: returnInv.id,
                partyId: returnInv.party?.id || undefined,
                direction: "IN",
                purpose: "Customer Receipt",
                amount: r2(pay),
                method: exchPayMethod,
                notes: `Exchange difference on ${returnInv.invoiceNumber}`,
              },
            });
          }
        } else if (exchDiff < -0.009 && exchRefund !== "ADJUST") {
          await api("/api/payments", {
            method: "POST",
            body: {
              partyId: returnInv.party?.id || undefined,
              direction: "OUT",
              purpose: "Customer Refund",
              amount: r2(-exchDiff),
              method: exchRefund,
              notes: `Exchange refund on ${returnInv.invoiceNumber}`,
            },
          });
        }
        setNotice(
          exchDiff > 0.009
            ? `🔄 Exchange recorded on ${returnInv.invoiceNumber} — extra ${formatMoney(
                exchDiff
              )} ${exchPay === "UNPAID" ? "left as pending on the bill" : "settled"}.`
            : exchDiff < -0.009
            ? `🔄 Exchange recorded on ${returnInv.invoiceNumber} — ${formatMoney(
                -exchDiff
              )} ${exchRefund === "ADJUST" ? "adjusted against the bill" : "refunded"}.`
            : `🔄 Even exchange recorded on ${returnInv.invoiceNumber}.`
        );
        setExch(false);
        setExchLines([emptyAddLine()]);
      }

      setReason("");
      setRetQty({});
      // Keep the modal open so the operator sees the return recorded and can
      // undo it if it was wrong.
      await refreshReturnModal(returnInv.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record return");
    } finally {
      setSaving(false);
    }
  }

  // Request to undo a wrong return. Shop users' requests are held for admin
  // approval; once approved the stock the return added is removed, the returned
  // quantity is freed (items count as sold again), and any cash refund is
  // reversed.
  async function deleteReturn(cn: CreditNote) {
    if (!returnInv) return;
    if (
      !confirm(
        `Request deletion of this return of ${formatMoney(cn.totalAmount)}? An admin must approve it. Once approved, the items go back to sold, the stock it added is removed, and any cash refund is reversed.`
      )
    )
      return;
    setSaving(true);
    setError("");
    try {
      const r = await api<{ pending?: boolean; message?: string } | undefined>(
        `/api/invoices/${returnInv.id}/return/${cn.id}`,
        { method: "DELETE" }
      );
      if (r?.pending) {
        // Held for admin approval — the return stays until approved.
        setReturnInv(null);
        setNotice(r.message ?? "Return deletion sent to the admin for approval.");
        await load();
        return;
      }
      // Platform admin: reversed immediately.
      await refreshReturnModal(returnInv.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request return deletion");
    } finally {
      setSaving(false);
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
                      <button
                        onClick={() => openAdd(inv)}
                        className="mr-3 text-brand hover:underline"
                        title="Customer took more items later? Add them to this bill."
                      >
                        + Add
                      </button>
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

      {addInv && (
        <Modal
          title={`Add items to ${addInv.invoiceNumber}`}
          onClose={() => setAddInv(null)}
        >
          <form onSubmit={submitAdd} className="space-y-4">
            <p className="text-sm text-gray-500">
              {addInv.party?.name} took more goods? Add them here — the bill total,
              GST, stock, pending amount, profit and all reports update automatically.
            </p>
            {addLines.map((l, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-start gap-2">
                  <div className="flex-1">
                    <ItemPicker
                      items={catalog.map((it) => ({
                        id: it.id,
                        name: it.name,
                        sku: it.sku,
                        barcode: it.barcode,
                        unit: it.unit,
                        price: Number(addInv.type === "SALE" ? it.salePrice : it.purchasePrice),
                        stock: it.isService ? null : Number(it.stockQty),
                      }))}
                      value={l.itemId}
                      onSelect={(id) => pickAddItem(i, id)}
                    />
                  </div>
                  {addLines.length > 1 && (
                    <button
                      type="button"
                      className="mt-2 text-red-500 hover:text-red-700"
                      onClick={() => setAddLines((ls) => ls.filter((_, x) => x !== i))}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Qty</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      className="input"
                      value={l.quantity}
                      onChange={(e) =>
                        setAddLines((ls) =>
                          ls.map((x, idx) =>
                            idx === i ? { ...x, quantity: Number(e.target.value) } : x
                          )
                        )
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={l.rate}
                      onChange={(e) =>
                        setAddLines((ls) =>
                          ls.map((x, idx) =>
                            idx === i ? { ...x, rate: Number(e.target.value) } : x
                          )
                        )
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Tax %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={l.taxRate}
                      onChange={(e) =>
                        setAddLines((ls) =>
                          ls.map((x, idx) =>
                            idx === i ? { ...x, taxRate: Number(e.target.value) } : x
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setAddLines((ls) => [...ls, emptyAddLine()])}
              >
                + Add another line
              </button>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={addInclusive}
                  onChange={(e) => setAddInclusive(e.target.checked)}
                />
                Rates include GST
              </label>
            </div>
            {/* Live preview of what this addition does to the bill. */}
            {(() => {
              const valid = addLines.filter((l) => l.description && l.quantity > 0);
              const addTotal = valid.reduce((s, l) => {
                const net = addInclusive ? l.rate / (1 + l.taxRate / 100) : l.rate;
                return s + l.quantity * net * (1 + l.taxRate / 100);
              }, 0);
              const newTotal = Number(addInv.total) + addTotal;
              const newDue = newTotal - Number(addInv.amountPaid);
              return (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-gray-600">
                  Adding <b>{formatMoney(addTotal)}</b> (incl GST) → new bill total{" "}
                  <b>{formatMoney(newTotal)}</b> · pending after this{" "}
                  <b className={newDue > 0.009 ? "text-rose-600" : "text-emerald-600"}>
                    {formatMoney(Math.max(0, newDue))}
                  </b>
                </div>
              );
            })()}
            {addError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</div>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setAddInv(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={addSaving}>
                {addSaving ? "Adding…" : "Add to Bill"}
              </button>
            </div>
          </form>
        </Modal>
      )}

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
            {lines.length > 0 && (
              <>
                {/* Exchange: return + take another product in one go. */}
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={exch}
                    onChange={(e) => setExch(e.target.checked)}
                  />
                  🔄 Return with another product (exchange)
                </label>

                {exch && (
                  <div className="space-y-3 rounded-xl border border-brand/30 bg-brand-light/20 p-3">
                    <p className="text-xs text-gray-500">
                      Pick what the customer is taking instead. Stock, bill total, GST,
                      profit and pending all update automatically.
                    </p>
                    {exchLines.map((l, i) => (
                      <div key={i} className="rounded-lg border border-slate-200 bg-white p-2">
                        <div className="mb-2 flex items-start gap-2">
                          <div className="flex-1">
                            <ItemPicker
                              items={catalog.map((it) => ({
                                id: it.id,
                                name: it.name,
                                sku: it.sku,
                                barcode: it.barcode,
                                unit: it.unit,
                                price: Number(it.salePrice),
                                stock: it.isService ? null : Number(it.stockQty),
                              }))}
                              value={l.itemId}
                              onSelect={(id) => pickExchItem(i, id)}
                            />
                          </div>
                          {exchLines.length > 1 && (
                            <button
                              type="button"
                              className="mt-2 text-red-500 hover:text-red-700"
                              onClick={() =>
                                setExchLines((ls) => ls.filter((_, x) => x !== i))
                              }
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            className="input"
                            placeholder="Qty"
                            value={l.quantity}
                            onChange={(e) =>
                              setExchLines((ls) =>
                                ls.map((x, idx) =>
                                  idx === i
                                    ? { ...x, quantity: Number(e.target.value) }
                                    : x
                                )
                              )
                            }
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input"
                            placeholder="Rate"
                            value={l.rate}
                            onChange={(e) =>
                              setExchLines((ls) =>
                                ls.map((x, idx) =>
                                  idx === i ? { ...x, rate: Number(e.target.value) } : x
                                )
                              )
                            }
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input"
                            placeholder="Tax %"
                            value={l.taxRate}
                            onChange={(e) =>
                              setExchLines((ls) =>
                                ls.map((x, idx) =>
                                  idx === i
                                    ? { ...x, taxRate: Number(e.target.value) }
                                    : x
                                )
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => setExchLines((ls) => [...ls, emptyAddLine()])}
                    >
                      + Another product
                    </button>

                    {/* Live settlement of the exchange difference. */}
                    <div className="rounded-lg bg-white px-3 py-2 text-sm text-gray-600">
                      Returning <b>{formatMoney(returnGross)}</b> · taking{" "}
                      <b>{formatMoney(exchGross)}</b> →{" "}
                      {exchDiff > 0.009 ? (
                        <b className="text-rose-600">
                          customer pays {formatMoney(exchDiff)} extra
                        </b>
                      ) : exchDiff < -0.009 ? (
                        <b className="text-emerald-600">
                          customer gets back {formatMoney(-exchDiff)}
                        </b>
                      ) : (
                        <b className="text-emerald-600">even exchange</b>
                      )}
                    </div>

                    {exchDiff > 0.009 && (
                      <div className="space-y-2">
                        <label className="label">Payment of the extra amount</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["PAID", "PARTIAL", "UNPAID"] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setExchPay(opt)}
                              className={`rounded-lg border-2 px-2 py-1.5 text-sm font-medium ${
                                exchPay === opt
                                  ? "border-brand bg-brand-light/40 text-brand"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              {opt === "PAID"
                                ? "Paid now"
                                : opt === "PARTIAL"
                                ? "Partially paid"
                                : "Unpaid"}
                            </button>
                          ))}
                        </div>
                        {exchPay !== "UNPAID" && (
                          <div className="grid grid-cols-2 gap-2">
                            {exchPay === "PARTIAL" && (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input"
                                placeholder="Amount received now"
                                value={exchPayAmount || ""}
                                onChange={(e) => setExchPayAmount(Number(e.target.value))}
                                required
                              />
                            )}
                            <select
                              className="input"
                              value={exchPayMethod}
                              onChange={(e) => setExchPayMethod(e.target.value)}
                            >
                              <option value="CASH">Cash</option>
                              <option value="BANK">Bank / UPI</option>
                            </select>
                          </div>
                        )}
                        <p className="text-xs text-gray-400">
                          Anything not paid now stays as pending on this bill and shows
                          in the overdue list until collected.
                        </p>
                      </div>
                    )}

                    {exchDiff < -0.009 && (
                      <div>
                        <label className="label">Give back the difference via</label>
                        <select
                          className="input"
                          value={exchRefund}
                          onChange={(e) =>
                            setExchRefund(e.target.value as "ADJUST" | "CASH" | "BANK")
                          }
                        >
                          <option value="ADJUST">
                            Adjust against this bill / customer&apos;s ledger (no cash)
                          </option>
                          <option value="CASH">Refund cash from the drawer</option>
                          <option value="BANK">Refund to bank</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {!exch && (
                  <div>
                    <label className="label">Refund the customer via</label>
                    <select
                      className="input"
                      value={refundMethod}
                      onChange={(e) =>
                        setRefundMethod(e.target.value as "CASH" | "BANK" | "NONE")
                      }
                    >
                      <option value="CASH">Cash — pay back from the cash drawer</option>
                      <option value="BANK">Bank — refund to bank</option>
                      <option value="NONE">
                        No cash paid — credit the customer&apos;s ledger only
                      </option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Cash or Bank records a refund voucher so your cash book drops by the
                      returned amount. Use ledger credit for account customers.
                    </p>
                  </div>
                )}
                <div>
                  <label className="label">Reason (optional)</label>
                  <input
                    className="input"
                    placeholder="e.g. damaged / wrong item"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </>
            )}

            {returnsList.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Returns recorded on this bill
                </p>
                <div className="space-y-1.5">
                  {returnsList.map((cn) => (
                    <div
                      key={cn.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800">
                          {formatMoney(cn.totalAmount)}
                        </span>
                        <span className="text-gray-500">
                          {" · "}
                          {formatDate(cn.createdAt)}
                          {" · "}
                          {cn.refundMethod
                            ? `refunded ${cn.refundMethod.toLowerCase()}`
                            : "ledger credit"}
                          {cn.reason ? ` · ${cn.reason}` : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteReturn(cn)}
                        disabled={saving}
                        className="shrink-0 rounded border border-red-300 px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Request delete
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  A wrong return is sent to the admin for approval. Once approved it puts the
                  items back as sold, removes the stock it added, and reverses any cash refund.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setReturnInv(null)}>
                {lines.length > 0 ? "Cancel" : "Close"}
              </button>
              {lines.length > 0 && (
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Processing…" : exch ? "Record Exchange" : "Record Return"}
                </button>
              )}
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
