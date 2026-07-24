"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import BillAttachments from "@/components/BillAttachments";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ItemPicker from "@/components/ItemPicker";

type Party = { id: string; name: string; type: string; phone?: string | null; email?: string | null };
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

type HistoryRow = {
  party: string;
  rate: number;
  taxRate: number;
  quantity: number;
  invoiceNumber: string;
  date: string;
};

const blankLine: Line = { itemId: "", description: "", quantity: 1, rate: 0, taxRate: 0 };
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function NewInvoicePage() {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [type, setType] = useState<"SALE" | "PURCHASE">("SALE");
  const [partyId, setPartyId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  // Uploaded bill document (supplier purchase bill).
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  // When on, the entered Rate already includes GST (tax is split out).
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ ...blankLine }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Cache of "price given before" per item (keyed by itemId).
  const [history, setHistory] = useState<Record<string, HistoryRow[]>>({});
  const [histLoading, setHistLoading] = useState<Record<string, boolean>>({});
  const [histError, setHistError] = useState<Record<string, boolean>>({});
  // Payment at billing time.
  const [payStatus, setPayStatus] = useState<"UNPAID" | "PAID" | "PARTIAL">("UNPAID");
  const [partAmount, setPartAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  // Split payment: part cash + part bank.
  const [splitPay, setSplitPay] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [bankAmount, setBankAmount] = useState(0);

  // Sales list customers; purchases list suppliers.
  const partyType = type === "SALE" ? "CUSTOMER" : "SUPPLIER";
  const partyLabel = type === "SALE" ? "customer" : "supplier";
  const filteredParties = parties.filter((p) => p.type === partyType);

  // Quick-add customer
  const [showNewParty, setShowNewParty] = useState(false);
  const [newParty, setNewParty] = useState({ name: "", phone: "", email: "" });
  const [savingParty, setSavingParty] = useState(false);
  // A same-name party the backend found — ask before creating a duplicate.
  const [dupParty, setDupParty] = useState<Party | null>(null);

  // Quick-add product (mirrors quick-add customer). newProductLine is the line
  // index the new product should drop into once created.
  const [newProductLine, setNewProductLine] = useState<number | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    unit: "PCS",
    salePrice: "",
    purchasePrice: "",
    taxRate: "",
    stockQty: "",
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState("");

  function useExistingParty(p: Party) {
    setParties((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
    setPartyId(p.id);
    setShowNewParty(false);
    setDupParty(null);
    setNewParty({ name: "", phone: "", email: "" });
  }

  async function createParty(e?: React.FormEvent, force = false) {
    e?.preventDefault();
    setSavingParty(true);
    try {
      const r = await api<{ party: Party }>("/api/parties", {
        method: "POST",
        body: {
          name: newParty.name.trim(),
          phone: newParty.phone || undefined,
          email: newParty.email || undefined,
          type: partyType,
          force,
        },
      });
      useExistingParty(r.party); // add + select + close
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const ex = (err.details as { existing?: Party } | undefined)?.existing ?? null;
        setDupParty(ex);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to add customer");
      }
    } finally {
      setSavingParty(false);
    }
  }

  function openNewProduct(i: number) {
    setNewProductLine(i);
    setNewProduct({ name: "", unit: "PCS", salePrice: "", purchasePrice: "", taxRate: "", stockQty: "" });
    setProductError("");
  }

  async function createProduct(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newProduct.name.trim()) {
      setProductError("Enter a product name.");
      return;
    }
    setSavingProduct(true);
    setProductError("");
    try {
      const r = await api<{ item: Item }>("/api/items", {
        method: "POST",
        body: {
          name: newProduct.name.trim(),
          unit: newProduct.unit.trim() || "PCS",
          salePrice: Number(newProduct.salePrice) || 0,
          purchasePrice: Number(newProduct.purchasePrice) || 0,
          taxRate: Number(newProduct.taxRate) || 0,
          stockQty: Number(newProduct.stockQty) || 0,
        },
      });
      const created = r.item;
      // Add to the product list and drop it straight into the line that asked.
      setItems((prev) => [created, ...prev]);
      if (newProductLine != null) {
        updateLine(newProductLine, {
          itemId: created.id,
          description: created.name,
          rate: Number(type === "SALE" ? created.salePrice : created.purchasePrice),
          taxRate: Number(created.taxRate),
        });
      }
      setNewProductLine(null);
    } catch (err) {
      setProductError(
        err instanceof ApiError
          ? err.status === 403
            ? "Only a manager or owner can add a new product."
            : err.message
          : "Failed to add product"
      );
    } finally {
      setSavingProduct(false);
    }
  }

  useEffect(() => {
    api<{ parties: Party[] }>("/api/parties").then((r) => setParties(r.parties));
    api<{ items: Item[] }>("/api/items").then((r) => setItems(r.items));
  }, []);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  // When an item is chosen, auto-fill description/rate/tax from the catalog.
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
    // Fetch what we last charged each customer for this product.
    if (type === "SALE" && itemId && history[itemId] === undefined && !histLoading[itemId]) {
      setHistLoading((s) => ({ ...s, [itemId]: true }));
      setHistError((s) => ({ ...s, [itemId]: false }));
      api<{ history: HistoryRow[] }>(`/api/items/${itemId}/price-history`)
        .then((r) => setHistory((h) => ({ ...h, [itemId]: r.history || [] })))
        .catch(() => setHistError((s) => ({ ...s, [itemId]: true })))
        .finally(() => setHistLoading((s) => ({ ...s, [itemId]: false })));
    }
  }

  // Available stock for a SALE line: null = no limit (purchase / service /
  // custom free-text line). Otherwise the on-hand quantity.
  function stockFor(itemId: string): number | null {
    if (type !== "SALE" || !itemId) return null;
    const it = items.find((x) => x.id === itemId);
    if (!it || it.isService) return null;
    return Number(it.stockQty);
  }

  // Ex-GST (taxable) rate/amount for a line. When tax-inclusive, the entered
  // rate is divided back out; otherwise it's used as-is.
  const netRate = (l: Line) => round2(l.rate / (taxInclusive ? 1 + l.taxRate / 100 : 1));
  const lineAmount = (l: Line) => round2(l.quantity * netRate(l));

  // Ex-GST cost of an item (purchase price is entered GST-inclusive). Used only
  // to show the biller a live profit hint — this never appears on the bill.
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
  const taxAmount = round2(
    lines.reduce((s, l) => s + (lineAmount(l) * l.taxRate) / 100, 0)
  );
  const total = round2(subtotal - discount + taxAmount);

  // How much is being paid at the time of billing.
  const splitTotal = (Number(cashAmount) || 0) + (Number(bankAmount) || 0);
  const paidNow =
    payStatus === "UNPAID"
      ? 0
      : splitPay
      ? splitTotal
      : payStatus === "PAID"
      ? total
      : Number(partAmount) || 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!partyId) return setError("Please select a party.");
    const validLines = lines.filter((l) => l.description && l.quantity > 0);
    if (validLines.length === 0) return setError("Add at least one line item.");

    // Block selling more than what's in stock.
    for (const l of validLines) {
      const max = stockFor(l.itemId);
      if (max !== null && l.quantity > max) {
        return setError(`Not enough stock for "${l.description}" — only ${max} available.`);
      }
    }
    if (payStatus === "PARTIAL" && !splitPay && (paidNow <= 0 || paidNow > total)) {
      return setError(`Enter a part-payment between 0 and ${total}.`);
    }
    if (payStatus !== "UNPAID" && splitPay && (paidNow <= 0 || paidNow > total)) {
      return setError(`Enter cash/bank amounts totalling between 0 and ${total}.`);
    }

    setSaving(true);
    try {
      const { invoice } = await api<{ invoice: { id: string } }>("/api/invoices", {
        method: "POST",
        body: {
          partyId,
          type,
          discount: Number(discount) || 0,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
          attachmentUrl: attachmentUrls[0] || undefined,
          attachmentUrl2: attachmentUrls[1] || undefined,
          attachmentUrl3: attachmentUrls[2] || undefined,
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

      // Record the payment received now (if any). SALE = money in, PURCHASE = money out.
      if (paidNow > 0) {
        const base = {
          partyId,
          invoiceId: invoice.id,
          direction: type === "SALE" ? "IN" : "OUT",
          purpose: type === "SALE" ? "Customer Receipt" : "Supplier Payment",
        };
        if (splitPay) {
          // One payment per method so the cash book tracks cash vs bank.
          const cash = Number(cashAmount) || 0;
          const bank = Number(bankAmount) || 0;
          if (cash > 0)
            await api("/api/payments", { method: "POST", body: { ...base, amount: cash, method: "CASH" } });
          if (bank > 0)
            await api("/api/payments", { method: "POST", body: { ...base, amount: bank, method: "BANK" } });
        } else {
          await api("/api/payments", { method: "POST", body: { ...base, amount: paidNow, method: payMethod } });
        }
      }

      // Go straight to the printable bill.
      router.push(`/invoices/${invoice.id}/print`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }


  return (
    <div>
      <PageHeader title="New Invoice" />
      <form onSubmit={save} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="card grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={type}
              onChange={(e) => {
                setType(e.target.value as any);
                setPartyId(""); // clear party — the list changes with type
              }}
            >
              <option value="SALE">Sale</option>
              <option value="PURCHASE">Purchase</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="label">{type === "SALE" ? "Customer" : "Supplier"}</label>
              <button
                type="button"
                onClick={() => setShowNewParty(true)}
                className="text-xs font-medium text-brand hover:underline"
              >
                + New {partyLabel}
              </button>
            </div>
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
                      <div className="mb-1 flex items-start gap-2">
                        <div className="flex-1">
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
                            onSelect={(id) => pickItem(i, id)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => openNewProduct(i)}
                          className="whitespace-nowrap pt-2 text-xs font-medium text-brand hover:underline"
                          title="Add a product that isn't in your list yet"
                        >
                          + New product
                        </button>
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
                      {type === "SALE" && l.itemId && (
                        <div className="mt-1">
                          {histLoading[l.itemId] ? (
                            <p className="text-[11px] text-slate-400">Checking earlier prices…</p>
                          ) : histError[l.itemId] ? (
                            <p className="text-[11px] text-amber-600">
                              Price history unavailable (backend may need a redeploy).
                            </p>
                          ) : history[l.itemId] === undefined ? null : history[l.itemId].length === 0 ? (
                            <p className="text-[11px] text-slate-400">
                              No earlier sale price for this product yet.
                            </p>
                          ) : (
                            <>
                              <p className="text-[11px] font-medium text-slate-400">
                                Given before (tap a name to use that price):
                              </p>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {history[l.itemId].slice(0, 6).map((h, k) => (
                                  <button
                                    type="button"
                                    key={k}
                                    onClick={() => updateLine(i, { rate: h.rate })}
                                    title={`${h.invoiceNumber} · ${new Date(
                                      h.date
                                    ).toLocaleDateString("en-IN")}${
                                      h.taxRate > 0
                                        ? ` · ${formatMoney(round2(h.rate * (1 + h.taxRate / 100)))} incl GST`
                                        : ""
                                    }`}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 transition hover:border-brand hover:bg-brand-light"
                                  >
                                    <span className="font-semibold text-slate-800">{h.party}</span> ·{" "}
                                    {formatMoney(h.rate)}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="table-td">
                      <input
                        type="number"
                        step="0.001"
                        min={0}
                        max={stockFor(l.itemId) ?? undefined}
                        className="input w-24 text-right"
                        value={l.quantity}
                        onChange={(e) => {
                          const max = stockFor(l.itemId);
                          let q = Number(e.target.value);
                          if (max !== null && q > max) q = max; // block over-stock
                          updateLine(i, { quantity: q });
                        }}
                      />
                      {stockFor(l.itemId) !== null && (
                        <div
                          className={`mt-1 text-right text-xs ${
                            l.quantity >= (stockFor(l.itemId) as number)
                              ? "text-red-600"
                              : "text-gray-400"
                          }`}
                        >
                          {stockFor(l.itemId)} in stock
                        </div>
                      )}
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
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={taxInclusive}
                onChange={(e) => setTaxInclusive(e.target.checked)}
              />
              Rate includes GST (tax-inclusive)
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
            <BillAttachments
              urls={attachmentUrls}
              onChange={setAttachmentUrls}
              label={type === "PURCHASE" ? "Supplier's purchase bill" : "Attach bill / document"}
              hint={
                type === "PURCHASE" ? (
                  <p className="mt-1 text-xs text-gray-400">
                    Saved on this purchase and the first file is linked to each product bought, so
                    you can view the supplier&apos;s bill from the product later.
                  </p>
                ) : undefined
              }
            />
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
                Rates entered include GST — tax is split out above, so the total is what the
                customer pays.
              </p>
            )}

            {/* Payment at billing time */}
            <div className="mt-3 border-t border-gray-200 pt-3">
              <label className="label">Payment status</label>
              <div className="flex gap-2">
                {(["UNPAID", "PAID", "PARTIAL"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPayStatus(s)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
                      payStatus === s
                        ? "bg-brand text-white"
                        : "border border-gray-300 text-gray-600"
                    }`}
                  >
                    {s === "PARTIAL" ? "Partial" : s === "PAID" ? "Paid" : "Unpaid"}
                  </button>
                ))}
              </div>
              {payStatus === "PARTIAL" && !splitPay && (
                <div className="mt-2">
                  <label className="label">Amount received now</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={partAmount}
                    onChange={(e) => setPartAmount(Number(e.target.value))}
                  />
                </div>
              )}
              {payStatus !== "UNPAID" && (
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={splitPay}
                    onChange={(e) => setSplitPay(e.target.checked)}
                  />
                  Split — part cash, part bank
                </label>
              )}
              {payStatus !== "UNPAID" && splitPay && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">💵 Cash</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">🏦 Bank / UPI</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={bankAmount}
                      onChange={(e) => setBankAmount(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
              {payStatus !== "UNPAID" && !splitPay && (
                <div className="mt-2">
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
              )}
              {payStatus !== "UNPAID" && (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-500">Balance after payment</span>
                  <span className={total - paidNow > 0 ? "font-semibold text-red-600" : ""}>
                    {formatMoney(total - paidNow)}
                  </span>
                </div>
              )}
            </div>
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
            {saving ? "Saving…" : "Create Invoice"}
          </button>
        </div>
      </form>

      {showNewParty && (
        <Modal title={`Add New ${partyLabel}`} onClose={() => setShowNewParty(false)}>
          <form onSubmit={createParty} className="space-y-4">
            <p className="text-sm text-gray-500">
              Quickly add a {partyLabel} — saved to your list automatically and selectable next
              time.
            </p>
            <div>
              <label className="label">{type === "SALE" ? "Customer" : "Supplier"} name</label>
              <input
                className="input"
                value={newParty.name}
                onChange={(e) => {
                  setNewParty({ ...newParty, name: e.target.value });
                  setDupParty(null);
                }}
                required
                autoFocus
              />
            </div>

            {dupParty && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-semibold text-amber-800">
                  “{dupParty.name}” already exists.
                </p>
                {(dupParty.phone || dupParty.email) && (
                  <p className="text-xs text-amber-700">
                    {[dupParty.phone, dupParty.email].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="mt-1 text-xs text-amber-700">
                  Is it the same {partyLabel}? Use them, or change the name above to add a
                  different one.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => useExistingParty(dupParty)}
                  >
                    ✓ Use “{dupParty.name}”
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800"
                    onClick={() => createParty(undefined, true)}
                    disabled={savingParty}
                  >
                    Add as a new {partyLabel} anyway
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={newParty.phone}
                  onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Email (optional)</label>
                <input
                  className="input"
                  value={newParty.email}
                  onChange={(e) => setNewParty({ ...newParty, email: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowNewParty(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={savingParty}>
                {savingParty ? "Saving…" : "Add & Select"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {newProductLine != null && (
        <Modal title="Add New Product" onClose={() => setNewProductLine(null)}>
          <form onSubmit={createProduct} className="space-y-4">
            {productError && <div className="text-sm text-red-600">{productError}</div>}
            <p className="text-sm text-gray-500">
              Quickly add a product — it&apos;s saved to your list and dropped into this bill line.
              You can fill in more details later from the Products page.
            </p>
            <div>
              <label className="label">Product name</label>
              <input
                className="input"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Sale price</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={newProduct.salePrice}
                  onChange={(e) => setNewProduct({ ...newProduct, salePrice: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Purchase price</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={newProduct.purchasePrice}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, purchasePrice: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Tax %</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={newProduct.taxRate}
                  onChange={(e) => setNewProduct({ ...newProduct, taxRate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Unit</label>
                <input
                  className="input"
                  placeholder="PCS"
                  value={newProduct.unit}
                  onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Opening stock</label>
                <input
                  type="number"
                  step="0.001"
                  className="input"
                  value={newProduct.stockQty}
                  onChange={(e) => setNewProduct({ ...newProduct, stockQty: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setNewProductLine(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={savingProduct}>
                {savingProduct ? "Saving…" : "Add & Select"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
