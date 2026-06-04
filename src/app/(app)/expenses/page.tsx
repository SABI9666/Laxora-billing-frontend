"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Expense = {
  id: string;
  category: string;
  amount: string;
  note?: string | null;
  invoiceId?: string | null;
  date: string;
};
type Invoice = { id: string; invoiceNumber: string };

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
  const [form, setForm] = useState({
    category: "Commission",
    amount: 0,
    note: "",
    invoiceId: "",
  });

  async function load() {
    // Load independently so a failure in one doesn't blank the other.
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
    setForm({ category: "Commission", amount: 0, note: "", invoiceId: "" });
    setError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/expenses", {
        method: "POST",
        body: {
          category: form.category,
          amount: Number(form.amount),
          note: form.note || undefined,
          invoiceId: form.invoiceId || undefined,
        },
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
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
        Record costs like electrician commission, damaged/returned material, transport,
        etc. These are subtracted in the Profit &amp; Loss report for true profit.
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
                <td className="table-td text-gray-500">{x.note || "—"}</td>
                <td className="table-td text-right font-semibold text-red-600">
                  {formatMoney(x.amount)}
                </td>
                <td className="table-td text-right">
                  <button onClick={() => remove(x)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td className="table-td text-gray-400" colSpan={6}>
                  No charges recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title="Record a Charge" onClose={() => setOpen(false)}>
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
              <label className="label">Related bill (optional)</label>
              <select
                className="input"
                value={form.invoiceId}
                onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
              >
                <option value="">— Not linked to a bill —</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber}
                  </option>
                ))}
              </select>
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
              <button type="submit" className="btn-primary">
                Save Charge
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
