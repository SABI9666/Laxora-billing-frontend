"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { productMatchRank, searchProducts } from "@/lib/productCode";

type Item = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  salePrice: string;
  taxRate: string;
  stockQty: string;
  isService: boolean;
};
type Party = { id: string; name: string };
type Line = { itemId: string; name: string; quantity: number; rate: number; taxRate: number };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const METHODS = ["CASH", "CARD", "UPI", "BANK", "CHEQUE", "OTHER"] as const;

export default function PosPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [partyId, setPartyId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<(typeof METHODS)[number]>("CASH");
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Quick-add customer
  const [showNewParty, setShowNewParty] = useState(false);
  const [newParty, setNewParty] = useState({ name: "", phone: "", gstin: "" });
  const [savingParty, setSavingParty] = useState(false);

  async function createParty(e: React.FormEvent) {
    e.preventDefault();
    setSavingParty(true);
    try {
      const r = await api<{ party: Party }>("/api/parties", {
        method: "POST",
        body: {
          name: newParty.name.trim(),
          phone: newParty.phone || undefined,
          // GST number makes this customer's bills B2B on the GST report.
          gstin: newParty.gstin.trim().toUpperCase() || undefined,
          type: "CUSTOMER",
        },
      });
      setParties((prev) => [...prev, r.party]);
      setPartyId(r.party.id);
      setShowNewParty(false);
      setNewParty({ name: "", phone: "", gstin: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add customer");
    } finally {
      setSavingParty(false);
    }
  }

  useEffect(() => {
    api<{ items: Item[] }>("/api/items").then((r) => setItems(r.items));
    api<{ parties: Party[] }>("/api/parties").then((r) => {
      const customers = r.parties;
      setParties(customers);
      if (customers[0]) setPartyId(customers[0].id);
    });
  }, []);

  // On-hand stock for an item; null = service (no limit).
  function stockOf(itemId: string): number | null {
    const it = items.find((x) => x.id === itemId);
    if (!it || it.isService) return null;
    return Number(it.stockQty);
  }

  function addItem(it: Item) {
    const max = it.isService ? null : Number(it.stockQty);
    setError("");
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === it.id);
      if (existing) {
        const next = existing.quantity + 1;
        if (max !== null && next > max) {
          setError(`Only ${max} of "${it.name}" in stock`);
          return prev;
        }
        return prev.map((l) => (l.itemId === it.id ? { ...l, quantity: next } : l));
      }
      if (max !== null && max < 1) {
        setError(`"${it.name}" is out of stock`);
        return prev;
      }
      return [
        ...prev,
        {
          itemId: it.id,
          name: it.name,
          quantity: 1,
          rate: Number(it.salePrice),
          taxRate: Number(it.taxRate),
        },
      ];
    });
  }

  // Enter in the search box: exact barcode/SKU match adds instantly (scanner).
  async function onSearchKey(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const term = search.trim();
    if (!term) return;
    // Exact barcode / product code / product number match adds instantly.
    const exact = items.find((i) => productMatchRank(term, i) === 0);
    if (exact) {
      addItem(exact);
      setSearch("");
      return;
    }
    // Fall back to a server lookup (covers codes not yet loaded locally).
    try {
      const r = await api<{ item: Item }>(
        `/api/items/lookup?barcode=${encodeURIComponent(term)}`
      );
      addItem(r.item);
      setSearch("");
    } catch {
      /* no exact match — leave the term for the filtered grid below */
    }
  }

  function setQty(itemId: string, qty: number) {
    const max = stockOf(itemId);
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemId !== itemId) return l;
        let q = Math.max(1, qty);
        if (max !== null && q > max) {
          setError(`Only ${max} in stock`);
          q = max; // block over-stock
        }
        return { ...l, quantity: q };
      })
    );
  }
  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  // Ranked search across name, product code, barcode and bare product number
  // ("9" finds BULB-009) — best matches first.
  const filtered = searchProducts(items, search);

  const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.rate, 0));
  const taxAmount = round2(
    lines.reduce((s, l) => s + (l.quantity * l.rate * l.taxRate) / 100, 0)
  );
  const total = round2(subtotal - discount + taxAmount);

  async function checkout() {
    setError("");
    if (!partyId) return setError("Select a customer first");
    if (lines.length === 0) return setError("Add at least one product");
    setSaving(true);
    try {
      const { invoice } = await api<{ invoice: { id: string; total: string } }>(
        "/api/invoices",
        {
          method: "POST",
          body: {
            partyId,
            type: "SALE",
            discount,
            items: lines.map((l) => ({
              itemId: l.itemId,
              description: l.name,
              quantity: l.quantity,
              rate: l.rate,
              taxRate: l.taxRate,
            })),
          },
        }
      );

      if (paid) {
        await api("/api/payments", {
          method: "POST",
          body: {
            partyId,
            invoiceId: invoice.id,
            amount: Number(invoice.total),
            method,
          },
        });
      }
      // Open the printable bill right away so the cashier can print/save PDF.
      router.push(`/invoices/${invoice.id}/print`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to complete sale");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Point of Sale" />
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Product picker */}
        <div className="lg:col-span-2">
          <input
            ref={searchRef}
            className="input mb-4"
            placeholder="Scan barcode or search products… (Enter to add exact match)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered
              .filter((i) => !i.isService)
              .slice(0, 24)
              .map((it) => (
                <button
                  key={it.id}
                  onClick={() => addItem(it)}
                  className="card p-3 text-left hover:border-brand"
                >
                  <div className="text-sm font-medium text-gray-900">{it.name}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {formatMoney(it.salePrice)} · stock {Number(it.stockQty)}
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Cart */}
        <div className="card flex flex-col">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <label className="label">Customer</label>
              <button
                type="button"
                onClick={() => setShowNewParty(true)}
                className="text-xs font-medium text-brand hover:underline"
              >
                + New customer
              </button>
            </div>
            <select
              className="input"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {lines.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">Cart is empty</p>
            )}
            {lines.map((l) => (
              <div key={l.itemId} className="flex items-center gap-2 border-b pb-2">
                <div className="flex-1">
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="text-xs text-gray-500">{formatMoney(l.rate)} ea</div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={stockOf(l.itemId) ?? undefined}
                  className="w-14 rounded border border-gray-200 px-2 py-1 text-sm"
                  value={l.quantity}
                  onChange={(e) => setQty(l.itemId, Number(e.target.value))}
                />
                <div className="w-20 text-right text-sm">
                  {formatMoney(l.quantity * l.rate)}
                </div>
                <button
                  onClick={() => removeLine(l.itemId)}
                  className="text-gray-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Discount</span>
              <input
                type="number"
                step="0.01"
                className="w-24 rounded border border-gray-200 px-2 py-1 text-right text-sm"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax</span>
              <span>{formatMoney(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              className="input"
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
              />
              Mark as paid
            </label>
          </div>

          <button
            onClick={checkout}
            disabled={saving}
            className="btn-primary mt-3 w-full py-3 text-base"
          >
            {saving ? "Processing…" : `Complete Sale · ${formatMoney(total)}`}
          </button>
        </div>
      </div>

      {showNewParty && (
        <Modal title="Add New Customer" onClose={() => setShowNewParty(false)}>
          <form onSubmit={createParty} className="space-y-4">
            <p className="text-sm text-gray-500">
              Saved to your customer list automatically and selected for this sale.
            </p>
            <div>
              <label className="label">Customer name</label>
              <input
                className="input"
                value={newParty.name}
                onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={newParty.phone}
                onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">GSTIN (optional — for B2B billing)</label>
              <input
                className="input uppercase"
                placeholder="e.g. 32ABCDE1234F1Z5"
                maxLength={15}
                value={newParty.gstin}
                onChange={(e) => setNewParty({ ...newParty, gstin: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-400">
                With a GSTIN the bill is reported as B2B in the GST report; without it, B2C.
              </p>
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
    </div>
  );
}
