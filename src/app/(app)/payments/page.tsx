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
// Cash <-> bank transfers. They are not money in or money out — they only move
// money between the shop's cash drawer and its bank account.
const TO_BANK = "Bank Deposit";
const TO_CASH = "Bank Withdrawal";
const TRANSFER_PURPOSES = [TO_BANK, TO_CASH];
// Payment-voucher (money out) purposes.
const OUT_PURPOSES = [
  "Supplier Payment",
  "Expense",
  TO_BANK,
  TO_CASH,
  "Other",
];
// Credit-voucher (money in) purposes. "Customer Receipt" settles a customer's
// bill; "Service Income" / "Other Income" are direct earnings (e.g. LED
// service) with no customer bill — they still hit the cash book and count as
// profit.
const IN_PURPOSES = ["Customer Receipt", "Service Income", "Other Income"];
// Credit-voucher purposes that are standalone income (no party / bill needed).
const IN_INCOME_PURPOSES = ["Service Income", "Other Income"];
const empty = {
  partyId: "",
  invoiceId: "",
  amount: 0,
  method: "CASH",
  notes: "",
  purpose: "Supplier Payment",
  // Split payment: part cash + part bank in one voucher.
  split: false,
  cashAmount: 0,
  bankAmount: 0,
  // When the money actually moved. Defaults to now (set in openNew), but a
  // voucher entered late can be back-dated so it lands on the right day in the
  // cash book and the right month in the reports.
  paymentDate: "",
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
    setForm({
      ...empty,
      purpose: dir === "IN" ? "Customer Receipt" : "Supplier Payment",
      paymentDate: toLocalInput(new Date()),
    });
    setError("");
    setOpen(true);
  }

  // Whether the current voucher needs a party / a linked bill.
  const isSupplierPay = !isCredit && form.purpose === "Supplier Payment";
  // A credit voucher needs a customer only when it settles their bill; direct
  // service / other income has no party.
  const isCustomerReceipt = isCredit && form.purpose === "Customer Receipt";
  const isServiceIncome = isCredit && IN_INCOME_PURPOSES.includes(form.purpose);
  const needsParty = isCustomerReceipt || isSupplierPay;
  const isTransfer = TRANSFER_PURPOSES.includes(form.purpose);

  const splitOn = form.split && !isTransfer;
  const splitTotal = (Number(form.cashAmount) || 0) + (Number(form.bankAmount) || 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const base = {
      partyId: needsParty ? form.partyId : undefined,
      invoiceId: needsParty ? form.invoiceId || undefined : undefined,
      direction,
      purpose: form.purpose || undefined,
      notes: form.notes || undefined,
      // Omitted only if the field was cleared — the server then stamps now.
      paymentDate: fromLocalInput(form.paymentDate),
    };
    if (splitOn) {
      const cash = Number(form.cashAmount) || 0;
      const bank = Number(form.bankAmount) || 0;
      if (cash + bank <= 0) return setError("Enter a cash and/or bank amount.");
    } else if (!(Number(form.amount) > 0)) {
      return setError("Enter an amount.");
    }
    setSaving(true);
    try {
      if (splitOn) {
        // Record one voucher per method so the cash book and bill update
        // correctly for each.
        const cash = Number(form.cashAmount) || 0;
        const bank = Number(form.bankAmount) || 0;
        if (cash > 0)
          await api("/api/payments", { method: "POST", body: { ...base, amount: cash, method: "CASH" } });
        if (bank > 0)
          await api("/api/payments", { method: "POST", body: { ...base, amount: bank, method: "BANK" } });
      } else {
        await api("/api/payments", {
          method: "POST",
          body: {
            ...base,
            amount: Number(form.amount),
            // Bank deposit/withdrawal are transfers — method is irrelevant.
            method: isTransfer ? "BANK" : form.method,
          },
        });
      }
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

  // Transfers are excluded from money in / money out — a cash deposit does not
  // leave the business, it just moves from the cash drawer into the bank.
  const isTransferVoucher = (p: Payment) =>
    !!p.purpose && TRANSFER_PURPOSES.includes(p.purpose);
  const sum = (rows: Payment[]) => rows.reduce((s, p) => s + Number(p.amount), 0);
  const totalIn = sum(
    payments.filter((p) => !isTransferVoucher(p) && (p.direction ?? "IN") === "IN")
  );
  const totalOut = sum(
    payments.filter((p) => !isTransferVoucher(p) && p.direction === "OUT")
  );
  const totalToBank = sum(payments.filter((p) => p.purpose === TO_BANK));
  const totalToCash = sum(payments.filter((p) => p.purpose === TO_CASH));

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
        <b>Credit voucher</b> = money received — a customer receipt, or direct{" "}
        <b>service / other income</b> (e.g. LED service). <b>Payment voucher</b> = money
        given (to a supplier). All update the cash book automatically, and service income
        also adds to your profit.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <span className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Money in: <b>{formatMoney(totalIn)}</b>
        </span>
        <span className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          Money out: <b>{formatMoney(totalOut)}</b>
        </span>
        {totalToBank > 0 && (
          <span className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
            Cash deposited into bank: <b>{formatMoney(totalToBank)}</b>
          </span>
        )}
        {totalToCash > 0 && (
          <span className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
            Withdrawn from bank as cash: <b>{formatMoney(totalToCash)}</b>
          </span>
        )}
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
                const transfer = isTransferVoucher(p);
                return (
                  <tr key={p.id}>
                    <td className="table-td">
                      <div>{formatDate(p.paymentDate)}</div>
                      <div className="text-xs text-gray-400">{formatTime(p.paymentDate)}</div>
                    </td>
                    <td className="table-td">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          transfer
                            ? "bg-blue-100 text-blue-700"
                            : isIn
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {transfer
                          ? "Transfer"
                          : isIn
                          ? "Credit (In)"
                          : "Payment (Out)"}
                      </span>
                    </td>
                    <td className="table-td font-medium">
                      {p.party?.name ?? p.purpose ?? "—"}
                    </td>
                    <td className="table-td text-gray-500">
                      {p.invoice?.invoiceNumber ?? (p.party ? p.purpose ?? "—" : "—")}
                    </td>
                    <td className="table-td">
                      {transfer
                        ? p.purpose === TO_BANK
                          ? "CASH → BANK"
                          : "BANK → CASH"
                        : p.method}
                    </td>
                    <td
                      className={`table-td text-right font-semibold ${
                        transfer
                          ? "text-blue-700"
                          : isIn
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {transfer ? "⇄ " : isIn ? "+" : "−"}
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

            {/* Choose what the voucher is for */}
            <div>
              <label className="label">Purpose</label>
              <select
                className="input"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value, partyId: "", invoiceId: "" })}
              >
                {(isCredit ? IN_PURPOSES : OUT_PURPOSES).map((p) => (
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
              {isServiceIncome && (
                <p className="mt-1 text-xs text-gray-400">
                  Direct income (e.g. LED service) — no customer bill needed. It
                  shows in the cash book and adds to your profit.
                </p>
              )}
            </div>

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
                  <option value="">— Auto-adjust against oldest pending bills —</option>
                  {invoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoiceNumber} (due {formatMoney(Number(i.total) - Number(i.amountPaid))})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Leave on auto-adjust and the amount clears this{" "}
                  {isCredit ? "customer" : "supplier"}&apos;s pending bills oldest first —
                  part payments reduce the due, full payments remove the bill from
                  pending automatically.
                </p>
              </div>
            )}

            {!isTransfer && (
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.split}
                  onChange={(e) => setForm({ ...form, split: e.target.checked })}
                />
                Received partly in cash and partly in bank (split)
              </label>
            )}

            {splitOn ? (
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">💵 Cash amount</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={form.cashAmount}
                      onChange={(e) => setForm({ ...form, cashAmount: Number(e.target.value) })}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="label">🏦 Bank / UPI amount</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={form.bankAmount}
                      onChange={(e) => setForm({ ...form, bankAmount: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <p className="mt-1 text-right text-sm text-gray-500">
                  Total: <b>{formatMoney(splitTotal)}</b>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    {isTransfer
                      ? form.purpose === TO_BANK
                        ? "Cash to deposit into the bank"
                        : "Cash to take out of the bank"
                      : "Amount"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
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
            )}
            <div>
              <label className="label">Date &amp; time of this voucher</label>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  className="input"
                  value={form.paymentDate}
                  onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0 text-sm"
                  onClick={() => setForm({ ...form, paymentDate: toLocalInput(new Date()) })}
                >
                  Now
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Defaults to right now. Change it for money that moved earlier — the cash book,
                the bill&apos;s pending amount and the reports all follow this date.
              </p>
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
