"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Party = { id: string; name: string; type: string };
type Invoice = { id: string; invoiceNumber: string; total: string; amountPaid: string };
type Payment = {
  id: string;
  direction?: "IN" | "OUT";
  purpose?: string | null;
  amount: string;
  method: string;
  paymentDate: string;
  notes?: string | null;
  party?: { name: string } | null;
  invoice?: { invoiceNumber: string } | null;
};

const METHODS = ["CASH", "BANK", "UPI", "CARD", "CHEQUE", "OTHER"];
// Payment-voucher (money out) purposes.
const OUT_PURPOSES = [
  "Supplier Payment",
  "Expense",
  "Bank Deposit",
  "Bank Withdrawal",
  "Other",
];
const empty = {
  partyId: "",
  invoiceId: "",
  amount: 0,
  method: "CASH",
  notes: "",
  purpose: "Supplier Payment",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [open, setOpen] = useState(false);
  // IN = credit voucher (money received), OUT = payment voucher (money given).
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isCredit = direction === "IN";
  // Credit vouchers come from customers; payment vouchers go to suppliers.
  const partyOptions = parties.filter((p) =>
    isCredit ? p.type === "CUSTOMER" : p.type === "SUPPLIER"
  );

  async function load() {
    const r = await api<{ payments: Payment[] }>("/api/payments");
    setPayments(r.payments);
  }
  useEffect(() => {
    load();
    api<{ parties: Party[] }>("/api/parties").then((r) => setParties(r.parties));
  }, []);

  // Load that party's unpaid bills (sales for credit, purchases for payment).
  useEffect(() => {
    if (!form.partyId) {
      setInvoices([]);
      return;
    }
    const invType = isCredit ? "SALE" : "PURCHASE";
    api<{ invoices: Invoice[] }>(
      `/api/invoices?type=${invType}&partyId=${form.partyId}`
    ).then((r) =>
      setInvoices(r.invoices.filter((i) => Number(i.total) > Number(i.amountPaid)))
    );
  }, [form.partyId, isCredit]);

  function openNew(dir: "IN" | "OUT") {
    setDirection(dir);
    setForm({ ...empty, purpose: dir === "IN" ? "Customer Receipt" : "Supplier Payment" });
    setError("");
    setOpen(true);
  }

  // Whether the current voucher needs a party / a linked bill.
  const isSupplierPay = !isCredit && form.purpose === "Supplier Payment";
  const needsParty = isCredit || isSupplierPay;
  const isTransfer = form.purpose === "Bank Deposit" || form.purpose === "Bank Withdrawal";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/payments", {
        method: "POST",
        body: {
          partyId: needsParty ? form.partyId : undefined,
          invoiceId: needsParty ? form.invoiceId || undefined : undefined,
          direction,
          purpose: form.purpose || undefined,
          amount: Number(form.amount),
          // Bank deposit/withdrawal are transfers — method is irrelevant.
          method: isTransfer ? "BANK" : form.method,
          notes: form.notes || undefined,
        },
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save voucher");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Payment) {
    if (!confirm("Delete this voucher?")) return;
    await api(`/api/payments/${p.id}`, { method: "DELETE" });
    await load();
  }

  const totalIn = payments
    .filter((p) => (p.direction ?? "IN") === "IN")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalOut = payments
    .filter((p) => p.direction === "OUT")
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <PageHeader
        title="Payments & Vouchers"
        action={
          <div className="flex gap-2">
            <button onClick={() => openNew("OUT")} className="btn-secondary">
              − Payment Voucher
            </button>
            <button onClick={() => openNew("IN")} className="btn-primary">
              + Credit Voucher
            </button>
          </div>
        }
      />

      <p className="mb-4 text-sm text-gray-500">
        <b>Credit voucher</b> = money received (from a customer, cash or bank).{" "}
        <b>Payment voucher</b> = money given (to a supplier). Both update the cash book and
        the linked bill automatically.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <span className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Money in: <b>{formatMoney(totalIn)}</b>
        </span>
        <span className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          Money out: <b>{formatMoney(totalOut)}</b>
        </span>
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">Type</th>
                <th className="table-th">Party</th>
                <th className="table-th">Bill</th>
                <th className="table-th">Mode</th>
                <th className="table-th text-right">Amount</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => {
                const isIn = (p.direction ?? "IN") === "IN";
                return (
                  <tr key={p.id}>
                    <td className="table-td">{formatDate(p.paymentDate)}</td>
                    <td className="table-td">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          isIn ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {isIn ? "Credit (In)" : "Payment (Out)"}
                      </span>
                    </td>
                    <td className="table-td font-medium">
                      {p.party?.name ?? p.purpose ?? "—"}
                    </td>
                    <td className="table-td text-gray-500">
                      {p.invoice?.invoiceNumber ?? (p.party ? p.purpose ?? "—" : "—")}
                    </td>
                    <td className="table-td">{p.method}</td>
                    <td
                      className={`table-td text-right font-semibold ${
                        isIn ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {isIn ? "+" : "−"}
                      {formatMoney(p.amount)}
                    </td>
                    <td className="table-td text-right">
                      <button
                        onClick={() => remove(p)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={7}>
                    No vouchers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal
          title={isCredit ? "Credit Voucher — Money Received" : "Payment Voucher — Money Given"}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={save} className="space-y-4">
            {error && <div className="text-sm text-red-600">{error}</div>}

            {/* Payment vouchers: choose what it's for */}
            {!isCredit && (
              <div>
                <label className="label">Purpose</label>
                <select
                  className="input"
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value, partyId: "", invoiceId: "" })}
                >
                  {OUT_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {isTransfer && (
                  <p className="mt-1 text-xs text-gray-400">
                    {form.purpose === "Bank Deposit"
                      ? "Moves money from shop cash into the bank."
                      : "Moves money from the bank into shop cash."}
                  </p>
                )}
              </div>
            )}

            {needsParty && (
              <div>
                <label className="label">
                  {isCredit ? "Received from (customer)" : "Paid to (supplier)"}
                </label>
                <select
                  className="input"
                  value={form.partyId}
                  onChange={(e) => setForm({ ...form, partyId: e.target.value, invoiceId: "" })}
                  required
                >
                  <option value="">Select {isCredit ? "customer" : "supplier"}…</option>
                  {partyOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needsParty && (
              <div>
                <label className="label">
                  Against bill (optional — their unpaid {isCredit ? "sales" : "purchase"} bills)
                </label>
                <select
                  className="input"
                  value={form.invoiceId}
                  onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
                >
                  <option value="">— Not linked to a bill —</option>
                  {invoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoiceNumber} (due {formatMoney(Number(i.total) - Number(i.amountPaid))})
                    </option>
                  ))}
                </select>
              </div>
            )}

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
              {!isTransfer && (
                <div>
                  <label className="label">Cash or Bank</label>
                  <select
                    className="input"
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input
                className="input"
                placeholder="e.g. reference / remarks"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : isCredit ? "Save Credit Voucher" : "Save Payment Voucher"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
