"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { uploadFile } from "@/lib/upload";
import PageHeader from "@/components/PageHeader";
import ItemPicker from "@/components/ItemPicker";

type Party = { id: string; name: string; type: string };
type Item = {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  salePrice: string;
  purchasePrice: string;
  taxRate: string;
  stockQty: string;
  isService: boolean;
};
type Line = {
  itemId: string;
  description: string;
  quantity: number;
  rate: number;
  taxRate: number;
};
type Payment = {
  id: string;
  amount: string;
  method: string;
  paymentDate: string;
  direction?: string;
  purpose?: string | null;
};
type Invoice = {
  id: string;
  invoiceNumber: string;
  type: "SALE" | "PURCHASE";
  status: string;
  partyId: string;
  invoiceDate: string;
  dueDate?: string | null;
  discount: string;
  total: string;
  amountPaid: string;
  notes?: string | null;
  attachmentUrl?: string | null;
  items: {
    itemId?: string | null;
    description: string;
    quantity: string;
    rate: string;
    taxRate: string;
  }[];
  payments?: Payment[];
};

const blankLine: Line = { itemId: "", description: "", quantity: 1, rate: 0, taxRate: 0 };
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [partyId, setPartyId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [uploadingBill, setUploadingBill] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ ...blankLine }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Payment editing.
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  const [paySplit, setPaySplit] = useState(false);
  const [payCash, setPayCash] = useState(0);
  const [payBank, setPayBank] = useState(0);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState("");

  const type = invoice?.type ?? "SALE";
  const partyType = type === "SALE" ? "CUSTOMER" : "SUPPLIER";
  const partyLabel = type === "SALE" ? "customer" : "supplier";
  const filteredParties = parties.filter((p) => p.type === partyType);

  useEffect(() => {
    Promise.all([
      api<{ invoice: Invoice }>(`/api/invoices/${id}`),
      api<{ parties: Party[] }>("/api/parties"),
      api<{ items: Item[] }>("/api/items"),
    ]).then(([inv, p, it]) => {
      setParties(p.parties);
      setItems(it.items);
      const i = inv.invoice;
      setInvoice(i);
      setPartyId(i.partyId);
      setDiscount(Number(i.discount) || 0);
      setNotes(i.notes || "");
      setAttachmentUrl(i.attachmentUrl || "");
      setDueDate(i.dueDate ? i.dueDate.slice(0, 10) : "");
      setPayAmount(round2(Number(i.total) - Number(i.amountPaid)));
      setLines(
        i.items.length
          ? i.items.map((l) => ({
              itemId: l.itemId || "",
              description: l.description,
              quantity: Number(l.quantity),
              rate: Number(l.rate),
              taxRate: Number(l.taxRate),
            }))
          : [{ ...blankLine }]
      );
    });
  }, [id]);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function pickItem(i: number, itemId: string) {
    const it = items.find((x) => x.id === itemId);
    if (!it) {
      updateLine(i, { itemId: "" });
      return;
    }
    updateLine(i, {
      itemId,
      description: it.name,
      rate: Number(type === "SALE" ? it.salePrice : it.purchasePrice),
      taxRate: Number(it.taxRate),
    });
  }

  const netRate = (l: Line) => round2(l.rate / (taxInclusive ? 1 + l.taxRate / 100 : 1));
  const lineAmount = (l: Line) => round2(l.quantity * netRate(l));

  // Ex-GST cost of an item, for the biller's profit hint (never on the bill).
  function itemCostEx(itemId: string): number | null {
    const it = items.find((x) => x.id === itemId);
    if (!it) return null;
    const pp = Number(it.purchasePrice);
    if (!pp) return null;
    return pp / (1 + Number(it.taxRate) / 100);
  }
  const estProfit =
    type === "SALE"
      ? round2(
          lines.reduce((s, l) => {
            const cost = l.itemId ? itemCostEx(l.itemId) : null;
            return cost == null ? s : s + (netRate(l) - cost) * l.quantity;
          }, 0)
        )
      : null;
  const subtotal = round2(lines.reduce((s, l) => s + lineAmount(l), 0));
  const taxAmount = round2(lines.reduce((s, l) => s + (lineAmount(l) * l.taxRate) / 100, 0));
  const total = round2(subtotal - discount + taxAmount);
  const amountPaid = Number(invoice?.amountPaid ?? 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!partyId) return setError("Please select a party.");
    const validLines = lines.filter((l) => l.description && l.quantity > 0);
    if (validLines.length === 0) return setError("Add at least one line item.");

    setSaving(true);
    try {
      await api(`/api/invoices/${id}`, {
        method: "PUT",
        body: {
          partyId,
          type,
          discount: Number(discount) || 0,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
          attachmentUrl: attachmentUrl || undefined,
          taxInclusive,
          items: validLines.map((l) => ({
            itemId: l.itemId || undefined,
            description: l.description,
            quantity: Number(l.quantity),
            rate: Number(l.rate),
            taxRate: Number(l.taxRate),
          })),
        },
      });
      router.push(`/invoices/${id}/print`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  }

  // ---- Payment editing (paid / partial / unpaid + cash / bank / split) ----
  const paidSoFar = Number(invoice?.amountPaid ?? 0);
  const savedTotal = Number(invoice?.total ?? 0);
  const balanceDue = round2(savedTotal - paidSoFar);

  async function reloadInvoice() {
    const r = await api<{ invoice: Invoice }>(`/api/invoices/${id}`);
    setInvoice(r.invoice);
    setPayAmount(round2(Number(r.invoice.total) - Number(r.invoice.amountPaid)));
  }

  async function recordPayment() {
    setPayError("");
    if (!invoice) return;
    const base = {
      partyId: invoice.partyId,
      invoiceId: id,
      direction: type === "SALE" ? "IN" : "OUT",
      purpose: type === "SALE" ? "Customer Receipt" : "Supplier Payment",
    };
    setPayBusy(true);
    try {
      if (paySplit) {
        const c = Number(payCash) || 0;
        const b = Number(payBank) || 0;
        if (c + b <= 0) {
          setPayError("Enter a cash and/or bank amount.");
          return;
        }
        if (c > 0)
          await api("/api/payments", { method: "POST", body: { ...base, amount: c, method: "CASH" } });
        if (b > 0)
          await api("/api/payments", { method: "POST", body: { ...base, amount: b, method: "BANK" } });
      } else {
        const amt = Number(payAmount) || 0;
        if (amt <= 0) {
          setPayError("Enter an amount.");
          return;
        }
        await api("/api/payments", { method: "POST", body: { ...base, amount: amt, method: payMethod } });
      }
      setPaySplit(false);
      setPayCash(0);
      setPayBank(0);
      await reloadInvoice();
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setPayBusy(false);
    }
  }

  async function deletePayment(pid: string) {
    if (!confirm("Remove this payment? The bill's paid amount and status will update.")) return;
    await api(`/api/payments/${pid}`, { method: "DELETE" });
    await reloadInvoice();
  }

  async function uploadBill(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBill(true);
    try {
      setAttachmentUrl(await uploadFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingBill(false);
      e.target.value = "";
    }
  }

  if (!invoice) return <div className="text-gray-400">Loading…</div>;

  return (
    <div>
      <PageHeader title={`Edit ${invoice.invoiceNumber}`} />
      <form onSubmit={save} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {amountPaid > 0 && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {formatMoney(amountPaid)} has already been paid on this bill. Editing keeps that
            payment and re-checks the paid/unpaid status against the new total.
          </div>
        )}

        <div className="card grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Type</label>
            <input className="input bg-gray-50" value={type} disabled />
          </div>
          <div>
            <label className="label">{type === "SALE" ? "Customer" : "Supplier"}</label>
            <select
              className="input"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              required
            >
              <option value="">Select {partyLabel}…</option>
              {filteredParties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th w-1/3">Item / Description</th>
                  <th className="table-th text-right">Qty</th>
                  <th className="table-th text-right">Rate</th>
                  <th className="table-th text-right">Tax %</th>
                  <th className="table-th text-right">Amount</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="table-td">
                      <div className="mb-1">
                        <ItemPicker
                          items={items.map((it) => ({
                            id: it.id,
                            name: it.name,
                            sku: it.sku,
                            unit: it.unit,
                            price: Number(type === "SALE" ? it.salePrice : it.purchasePrice),
                            stock: it.isService ? null : Number(it.stockQty),
                            low: !it.isService && Number(it.stockQty) <= 0,
                          }))}
                          value={l.itemId}
                          onSelect={(itemId) => pickItem(i, itemId)}
                        />
                      </div>
                      <input
                        className="input"
                        placeholder="Description"
                        value={l.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                      />
                      {type === "SALE" &&
                        l.itemId &&
                        (() => {
                          const cost = itemCostEx(l.itemId);
                          if (cost == null) return null;
                          const m = round2(netRate(l) - cost);
                          const pct = cost > 0 ? Math.round((m / cost) * 100) : null;
                          return (
                            <p
                              className={`mt-1 text-xs font-semibold ${
                                m > 0 ? "text-green-600" : m < 0 ? "text-red-600" : "text-gray-400"
                              }`}
                            >
                              {m > 0
                                ? `▲ Profit ${formatMoney(m)}/pc${pct != null ? ` · ${pct}%` : ""}`
                                : m < 0
                                ? `▼ Below cost ${formatMoney(Math.abs(m))}/pc`
                                : "• At cost"}
                            </p>
                          );
                        })()}
                    </td>
                    <td className="table-td">
                      <input
                        type="number"
                        step="0.001"
                        min={0}
                        className="input w-24 text-right"
                        value={l.quantity}
                        onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td className="table-td">
                      <input
                        type="number"
                        step="0.01"
                        className="input w-28 text-right"
                        value={l.rate}
                        onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                      />
                    </td>
                    <td className="table-td">
                      <input
                        type="number"
                        step="0.01"
                        className="input w-20 text-right"
                        value={l.taxRate}
                        onChange={(e) => updateLine(i, { taxRate: Number(e.target.value) })}
                      />
                    </td>
                    <td className="table-td text-right font-medium">
                      {formatMoney(lineAmount(l))}
                    </td>
                    <td className="table-td text-right">
                      <button
                        type="button"
                        onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                        className="text-red-600 hover:underline"
                        disabled={lines.length === 1}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-3">
            <button
              type="button"
              onClick={() => setLines([...lines, { ...blankLine }])}
              className="btn-secondary"
            >
              + Add Line
            </button>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-600"
                checked={taxInclusive}
                onChange={(e) => setTaxInclusive(e.target.checked)}
              />
              Prices include GST
              <span className="font-normal text-amber-600">— tax is split out automatically</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div className="card flex-1">
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="mt-3 border-t border-gray-100 pt-3">
              <label className="label">
                {type === "PURCHASE" ? "Supplier's purchase bill" : "Attach bill / document"}{" "}
                <span className="font-normal text-gray-400">(photo or PDF, optional)</span>
              </label>
              <input type="file" accept="image/*,application/pdf" onChange={uploadBill} className="block text-sm" />
              {uploadingBill && <p className="mt-1 text-xs text-brand">Uploading…</p>}
              {attachmentUrl && (
                <p className="mt-1 text-xs">
                  <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    ✓ Bill attached — view
                  </a>
                  <button
                    type="button"
                    onClick={() => setAttachmentUrl("")}
                    className="ml-3 text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </p>
              )}
            </div>
          </div>
          <div className="card w-full md:w-80">
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-500">Discount</span>
              <input
                type="number"
                step="0.01"
                className="input w-28 text-right"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-500">Tax</span>
              <span>{formatMoney(taxAmount)}</span>
            </div>
            {type === "SALE" && estProfit !== null && (
              <div className="flex justify-between rounded-lg bg-slate-50 px-2 py-1 text-sm">
                <span className="text-gray-500">Est. profit 🔒 <span className="text-xs">(not on bill)</span></span>
                <span className={`font-bold ${estProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatMoney(estProfit)}
                </span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
            {taxInclusive && (
              <p className="mt-1 text-xs text-gray-400">
                Rates entered include GST — tax is split out above.
              </p>
            )}
            {amountPaid > 0 && (
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-gray-500">Balance after paid</span>
                <span className={total - amountPaid > 0 ? "font-semibold text-red-600" : ""}>
                  {formatMoney(total - amountPaid)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/invoices")}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      {/* ===== Payments ===== */}
      <div className="card mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">Payments</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              balanceDue <= 0.009
                ? "bg-emerald-50 text-emerald-700"
                : paidSoFar > 0
                ? "bg-amber-50 text-amber-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {balanceDue <= 0.009 ? "PAID" : paidSoFar > 0 ? "PARTIALLY PAID" : "UNPAID"}
          </span>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-400">Bill Total</p>
            <p className="font-bold">{formatMoney(savedTotal)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-400">Paid</p>
            <p className="font-bold text-emerald-600">{formatMoney(paidSoFar)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-400">Balance Due</p>
            <p className={`font-bold ${balanceDue > 0.009 ? "text-rose-600" : "text-slate-500"}`}>
              {formatMoney(balanceDue)}
            </p>
          </div>
        </div>

        {/* Existing payments */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="mb-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-slate-600">
                  <span className="font-medium">{formatMoney(p.amount)}</span> · {p.method}
                  <span className="ml-2 text-xs text-slate-400">
                    {new Date(p.paymentDate).toLocaleDateString("en-IN")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deletePayment(p.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Record a payment */}
        {balanceDue > 0.009 ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Record a payment {type === "SALE" ? "received" : "made"}
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={paySplit}
                  onChange={(e) => setPaySplit(e.target.checked)}
                />
                Split — part cash, part bank
              </label>
            </div>
            {payError && <p className="mb-2 text-xs text-red-600">{payError}</p>}

            {paySplit ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">💵 Cash</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={payCash}
                    onChange={(e) => setPayCash(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">🏦 Bank / UPI</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={payBank}
                    onChange={(e) => setPayBank(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    onClick={() => setPayAmount(balanceDue)}
                    className="mt-1 text-xs font-medium text-brand hover:underline"
                  >
                    Full balance {formatMoney(balanceDue)}
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
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={recordPayment}
                disabled={payBusy}
              >
                {payBusy ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            ✓ This bill is fully paid.
          </p>
        )}
        <p className="mt-2 text-xs text-slate-400">
          To mark <b>Paid</b>, record the full balance. For <b>Partial</b>, record a smaller
          amount. To make it <b>Unpaid</b>, remove the payment(s) above.
        </p>
      </div>
    </div>
  );
}
