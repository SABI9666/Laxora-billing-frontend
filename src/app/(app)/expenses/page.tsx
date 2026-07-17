"use client";

import { useEffect, useState } from "react";
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

type Expense = {
  id: string;
  category: string;
  amount: string;
  note?: string | null;
  invoiceId?: string | null;
  method?: string | null;
  date: string;
};
type Invoice = { id: string; invoiceNumber: string };
type BillItem = {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  returnedQty?: string;
};
const remainingQty = (l: BillItem) => Number(l.quantity) - Number(l.returnedQty ?? 0);

const RETURN = "Return Material";
const CATEGORIES = [
  "Commission",
  "Electrician Charge",
  RETURN,
  "Damaged Material",
  "Transport",
  "Rent",
  "Salary",
  "Other",
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "Commission",
    amount: 0,
    note: "",
    invoiceId: "",
    method: "CASH",
    // How a return is refunded: "" = credit ledger only (no cash moves), else CASH/BANK.
    refundMethod: "",
  });
  // When set, we're editing this charge (id + its original date to preserve).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  // Return-mode state: the selected bill's items + how many to return.
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  // Returns already recorded on the selected bill (so wrong ones can be undone).
  const [existingReturns, setExistingReturns] = useState<ReturnRow[]>([]);

  const isReturn = form.category === RETURN;

  async function load() {
    try {
      const e = await api<{ expenses: Expense[] }>("/api/expenses");
      setExpenses(e.expenses);
    } catch {
      /* expenses endpoint may not be deployed yet */
    }
    try {
      const inv = await api<{ invoices: Invoice[] }>("/api/invoices?type=SALE");
      setInvoices(inv.invoices);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function loadReturns(invoiceId: string) {
    try {
      const r = await api<{ returns: ReturnRow[] }>(`/api/invoices/${invoiceId}/returns`);
      setExistingReturns(r.returns);
    } catch {
      setExistingReturns([]);
    }
  }

  // When in return mode and a bill is chosen, load that bill's items + past returns.
  useEffect(() => {
    if (!isReturn || !form.invoiceId) {
      setBillItems([]);
      setRetQty({});
      setExistingReturns([]);
      return;
    }
    api<{ invoice: { items: BillItem[] } }>(`/api/invoices/${form.invoiceId}`).then((r) =>
      setBillItems(r.invoice.items.filter((l) => remainingQty(l) > 0.0001))
    );
    loadReturns(form.invoiceId);
  }, [isReturn, form.invoiceId]);

  async function deleteReturn(rid: string) {
    const why = prompt(
      "Report this return as wrong? It will be sent to the admin for approval, and only removed once they approve.\n\nReason (optional):",
      ""
    );
    if (why === null) return; // cancelled
    try {
      const r = await api<{ pending?: boolean; message?: string }>(
        `/api/invoices/${form.invoiceId}/return/${rid}`,
        { method: "DELETE", body: { reason: why || undefined } }
      );
      if (r?.pending) alert(r.message || "Sent to the admin for approval.");
      // Refresh items (a platform admin's removal takes effect immediately).
      const inv = await api<{ invoice: { items: BillItem[] } }>(`/api/invoices/${form.invoiceId}`);
      setBillItems(inv.invoice.items.filter((l) => remainingQty(l) > 0.0001));
      await loadReturns(form.invoiceId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not submit this request");
    }
  }

  function openNew() {
    setForm({
      category: "Commission",
      amount: 0,
      note: "",
      invoiceId: "",
      method: "CASH",
      refundMethod: "",
    });
    setEditingId(null);
    setEditingDate(null);
    setBillItems([]);
    setRetQty({});
    setError("");
    setOpen(true);
  }

  function openEdit(x: Expense) {
    setForm({
      category: x.category,
      amount: Number(x.amount),
      note: x.note || "",
      invoiceId: x.invoiceId || "",
      method: x.method || "CASH",
      refundMethod: "",
    });
    setEditingId(x.id);
    setEditingDate(x.date);
    setBillItems([]);
    setRetQty({});
    setError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (isReturn) {
        // Process a sales return: stock back up + bill/profit adjusted.
        if (!form.invoiceId) throw new Error("Select the bill the material is returned from");
        const items = Object.entries(retQty)
          .filter(([, q]) => q > 0)
          .map(([invoiceItemId, quantity]) => ({ invoiceItemId, quantity }));
        if (items.length === 0) throw new Error("Enter a return quantity for at least one item");
        await api(`/api/invoices/${form.invoiceId}/return`, {
          method: "POST",
          body: {
            items,
            reason: form.note || undefined,
            refundMethod: form.refundMethod || undefined,
          },
        });
      } else {
        // Save the (edited) charge. For an edit we create the updated one with
        // the original date, then remove the old record.
        await api("/api/expenses", {
          method: "POST",
          body: {
            category: form.category,
            amount: Number(form.amount),
            note: form.note || undefined,
            invoiceId: form.invoiceId || undefined,
            method: form.method || undefined,
            date: editingId ? editingDate ?? undefined : undefined,
          },
        });
        if (editingId) {
          await api(`/api/expenses/${editingId}`, { method: "DELETE" });
        }
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to save"
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(x: Expense) {
    if (!confirm(`Delete this ${x.category} charge of ${formatMoney(x.amount)}?`)) return;
    await api(`/api/expenses/${x.id}`, { method: "DELETE" });
    await load();
  }

  const total = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const invNo = (id?: string | null) =>
    id ? invoices.find((i) => i.id === id)?.invoiceNumber ?? "—" : "—";

  return (
    <div>
      <PageHeader
        title="Expenses & Charges"
        action={
          <button onClick={openNew} className="btn-primary">
            + Record Charge
          </button>
        }
      />

      <p className="mb-4 text-sm text-gray-500">
        Record costs like electrician commission, damaged material, transport, etc. Choosing{" "}
        <b>Return Material</b> puts items back in stock and adjusts the bill. All of these are
        reflected in the Profit &amp; Loss report.
      </p>

      <div className="mb-4 inline-block rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
        Total charges: <b>{formatMoney(total)}</b>
      </div>

      <div className="card p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">Date</th>
              <th className="table-th">Category</th>
              <th className="table-th">For Bill</th>
              <th className="table-th">Paid via</th>
              <th className="table-th">Note</th>
              <th className="table-th text-right">Amount</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {expenses.map((x) => (
              <tr key={x.id}>
                <td className="table-td">{formatDate(x.date)}</td>
                <td className="table-td font-medium">{x.category}</td>
                <td className="table-td text-gray-500">{invNo(x.invoiceId)}</td>
                <td className="table-td text-gray-500">{x.method || "—"}</td>
                <td className="table-td text-gray-500">{x.note || "—"}</td>
                <td className="table-td text-right font-semibold text-red-600">
                  {formatMoney(x.amount)}
                </td>
                <td className="table-td text-right">
                  <button
                    onClick={() => openEdit(x)}
                    className="mr-3 text-brand hover:underline"
                  >
                    Edit
                  </button>
                  <button onClick={() => remove(x)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td className="table-td text-gray-400" colSpan={7}>
                  No charges recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal
          title={editingId ? "Edit Charge" : "Record a Charge"}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={save} className="space-y-4">
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES
                  // Can't turn an existing charge into a material return.
                  .filter((c) => !editingId || c !== RETURN)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            {/* Related bill: required for returns, optional otherwise */}
            <div>
              <label className="label">
                {isReturn ? "Bill the material is returned from" : "Related bill (optional)"}
              </label>
              <select
                className="input"
                value={form.invoiceId}
                onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
                required={isReturn}
              >
                <option value="">{isReturn ? "Select bill…" : "— Not linked to a bill —"}</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber}
                  </option>
                ))}
              </select>
              {!isReturn && form.invoiceId && (
                <p className="mt-1 text-xs text-gray-400">
                  This charge settles the bill&apos;s outstanding due (up to whatever is still
                  pending), and the bill&apos;s status updates to Paid/Partial accordingly.
                </p>
              )}
            </div>

            {isReturn ? (
              /* Return mode: pick which items + how many are returned */
              <div>
                <label className="label">Returned items (stock will go back up)</label>
                {!form.invoiceId && (
                  <p className="text-sm text-gray-400">Select a bill above to load its items.</p>
                )}
                <div className="space-y-2">
                  {billItems.map((l) => {
                    const remain = remainingQty(l);
                    const already = Number(l.returnedQty ?? 0);
                    return (
                      <div key={l.id} className="flex items-center gap-2 border-b pb-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{l.description}</div>
                          <div className="text-xs text-gray-500">
                            Sold {Number(l.quantity)} @ {formatMoney(l.rate)}
                            {already > 0 && (
                              <span className="text-amber-600"> · {already} already returned</span>
                            )}
                            <span className="text-green-600"> · {remain} can be returned</span>
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
                  {form.invoiceId && billItems.length === 0 && (
                    <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                      ✓ No products left to return on this bill — everything has already been
                      returned.
                    </p>
                  )}
                </div>

                {/* Refund: only when money is physically handed back to the customer. */}
                {billItems.length > 0 && (
                  <div className="mt-4">
                    <label className="label">Refund the customer</label>
                    <select
                      className="input"
                      value={form.refundMethod}
                      onChange={(e) => setForm({ ...form, refundMethod: e.target.value })}
                    >
                      <option value="">No cash refund — just credit their account</option>
                      <option value="CASH">Give cash back (reduces cash balance)</option>
                      <option value="BANK">Bank transfer back (reduces bank balance)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-400">
                      {form.refundMethod
                        ? `The refund amount will be taken out of this shop's ${
                            form.refundMethod === "BANK" ? "bank" : "cash"
                          } in the cash book.`
                        : "Use this if the customer already paid and you're handing money back. Otherwise it just lowers what they owe."}
                    </p>
                  </div>
                )}

                {/* Returns already recorded on this bill — undo a wrong one. */}
                {form.invoiceId && existingReturns.length > 0 && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
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
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Paid via</label>
                  <select
                    className="input"
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    {["CASH", "BANK", "UPI", "CARD", "CHEQUE", "OTHER"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">
                    Reduces this shop&apos;s {form.method === "CASH" ? "cash" : "bank"} balance in
                    the cash book.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="label">Note (optional)</label>
              <input
                className="input"
                placeholder={isReturn ? "e.g. reason for return" : "e.g. electrician name / reason"}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving
                  ? "Saving…"
                  : isReturn
                  ? "Process Return"
                  : editingId
                  ? "Save Changes"
                  : "Save Charge"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
