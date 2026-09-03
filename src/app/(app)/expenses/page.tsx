"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  formatMoney,
  formatDate,
  formatTime,
  toLocalInput,
  fromLocalInput,
} from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

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

// Sales returns / exchanges are NOT recorded here — they are handled from the
// bill itself (Invoices → Return), where the returned quantity, the stock, the
// bill total and any cash refund are all adjusted together in one step.
const CATEGORIES = [
  "Commission",
  "Electrician Charge",
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
    // When the charge was actually incurred — defaults to now, but a charge
    // entered late can be back-dated so it lands in the right day's cash book
    // and the right month's P&L.
    date: "",
  });
  // When set, we're editing this charge.
  const [editingId, setEditingId] = useState<string | null>(null);

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

  function openNew() {
    setForm({
      category: "Commission",
      amount: 0,
      note: "",
      invoiceId: "",
      method: "CASH",
      date: toLocalInput(new Date()),
    });
    setEditingId(null);
    setError("");
    setOpen(true);
  }

  function openEdit(x: Expense) {
    setForm({
      category: x.category,
      amount: Number(x.amount),
      note: x.note || "",
      invoiceId: x.invoiceId || "",
      method: x.method ?? (x.invoiceId ? "" : "CASH"),
      date: toLocalInput(x.date),
    });
    setEditingId(x.id);
    setError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
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
          // Omitted only if the field was cleared — the server then stamps now.
          date: fromLocalInput(form.date),
        },
      });
      if (editingId) {
        await api(`/api/expenses/${editingId}`, { method: "DELETE" });
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
        Record costs like electrician commission, damaged material, transport, etc. All of these
        are reflected in the Profit &amp; Loss report.
      </p>

      <div className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">
        Returning goods? Do it from <b>Invoices → Return</b> on the bill. That puts the stock back,
        adjusts the bill total, GST and profit, and records any refund or exchange in the cash book
        — all in one step.
      </div>

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
                <td className="table-td">
                  <div>{formatDate(x.date)}</div>
                  <div className="text-xs text-gray-400">{formatTime(x.date)}</div>
                </td>
                <td className="table-td font-medium">{x.category}</td>
                <td className="table-td text-gray-500">{invNo(x.invoiceId)}</td>
                <td className="table-td text-gray-500">
                  {x.method || (x.invoiceId ? "Adjusted" : "—")}
                </td>
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
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Related bill (optional)</label>
              <select
                className="input"
                value={form.invoiceId}
                onChange={(e) => {
                  const invoiceId = e.target.value;
                  setForm({
                    ...form,
                    invoiceId,
                    // A charge against a bill is usually deducted from what the
                    // customer owes (no cash moves), so that becomes the default
                    // when a bill is picked; without a bill, cash is the only
                    // sensible meaning.
                    method: invoiceId ? "" : form.method || "CASH",
                  });
                }}
              >
                <option value="">— Not linked to a bill —</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber}
                  </option>
                ))}
              </select>
              {form.invoiceId && (
                <p className="mt-1 text-xs text-gray-400">
                  Deducted from what the customer still owes on this bill (up to the pending
                  amount) — the bill goes Paid/Partial accordingly, and the charge shows on
                  their ledger under its own name with your note.
                </p>
              )}
            </div>

            <div>
              <label className="label">Date &amp; time of the charge</label>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  className="input"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0 text-sm"
                  onClick={() => setForm({ ...form, date: toLocalInput(new Date()) })}
                >
                  Now
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Defaults to right now. Change it to record a charge you paid earlier — it then
                lands on that day in the cash book and in that month&apos;s Profit &amp; Loss.
              </p>
            </div>

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
                  {form.invoiceId && (
                    <option value="">Adjusted against the bill — no cash paid</option>
                  )}
                  {["CASH", "BANK", "UPI", "CARD", "CHEQUE", "OTHER"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  {form.method === ""
                    ? "No money moves. The amount comes off what the customer owes on the bill and counts as a cost in Profit & Loss."
                    : form.invoiceId
                    ? `Money leaves the shop — the ${
                        form.method === "CASH" ? "cash" : "bank"
                      } balance drops — and the amount also comes off what the customer still owes on the bill. If they are paying the bill in full, pick this only for a real cash payout: it then shows on their ledger as the shop's cost without reducing an already-paid bill.`
                    : `Reduces this shop's ${
                        form.method === "CASH" ? "cash" : "bank"
                      } balance in the cash book.`}
                </p>
              </div>
            </div>

            <div>
              <label className="label">Note (optional)</label>
              <input
                className="input"
                placeholder="e.g. electrician name / reason"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Save Charge"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
