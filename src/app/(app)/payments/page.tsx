"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Party = { id: string; name: string };
type Invoice = { id: string; invoiceNumber: string; total: string; amountPaid: string };
type Payment = {
  id: string;
  amount: string;
  method: string;
  paymentDate: string;
  party: { name: string };
};

const empty = { partyId: "", invoiceId: "", amount: 0, method: "CASH", notes: "" };

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await api<{ payments: Payment[] }>("/api/payments");
    setPayments(r.payments);
  }
  useEffect(() => {
    load();
    api<{ parties: Party[] }>("/api/parties").then((r) => setParties(r.parties));
  }, []);

  // Load unpaid invoices for the selected party when recording a payment.
  useEffect(() => {
    if (!form.partyId) {
      setInvoices([]);
      return;
    }
    api<{ invoices: Invoice[] }>(
      `/api/invoices?type=SALE&partyId=${form.partyId}`
    ).then((r) =>
      setInvoices(r.invoices.filter((i) => Number(i.total) > Number(i.amountPaid)))
    );
  }, [form.partyId]);

  function openNew() {
    setForm(empty);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/payments", {
        method: "POST",
        body: {
          partyId: form.partyId,
          invoiceId: form.invoiceId || undefined,
          amount: Number(form.amount),
          method: form.method,
          notes: form.notes || undefined,
        },
      });
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Payment) {
    if (!confirm("Delete this payment?")) return;
    await api(`/api/payments/${p.id}`, { method: "DELETE" });
    await load();
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader
        title="Payments"
        action={
          <button onClick={openNew} className="btn-primary">
            + Record Payment
          </button>
        }
      />

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">Party</th>
                <th className="table-th">Method</th>
                <th className="table-th text-right">Amount</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="table-td">{formatDate(p.paymentDate)}</td>
                  <td className="table-td font-medium">{p.party?.name}</td>
                  <td className="table-td">{p.method}</td>
                  <td className="table-td text-right">{formatMoney(p.amount)}</td>
                  <td className="table-td text-right">
                    <button
                      onClick={() => remove(p)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={5}>
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal title="Record Payment" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label">Party</label>
              <select className="input" value={form.partyId} onChange={set("partyId")} required>
                <option value="">Select party…</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Against Invoice (optional)</label>
              <select className="input" value={form.invoiceId} onChange={set("invoiceId")}>
                <option value="">On account (no specific invoice)</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber} — due {formatMoney(Number(i.total) - Number(i.amountPaid))}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.amount}
                  onChange={set("amount")}
                  required
                />
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" value={form.method} onChange={set("method")}>
                  {["CASH", "BANK", "UPI", "CARD", "CHEQUE", "OTHER"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={set("notes")} />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
