"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Party = { id: string; name: string };
type Item = { id: string; name: string; salePrice: string; purchasePrice: string; taxRate: string };
type Line = {
  itemId: string;
  description: string;
  quantity: number;
  rate: number;
  taxRate: number;
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
  const [lines, setLines] = useState<Line[]>([{ ...blankLine }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Quick-add customer
  const [showNewParty, setShowNewParty] = useState(false);
  const [newParty, setNewParty] = useState({ name: "", phone: "", email: "" });
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
          email: newParty.email || undefined,
          type: "CUSTOMER",
        },
      });
      // Add to the list and select it immediately.
      setParties((prev) => [...prev, r.party]);
      setPartyId(r.party.id);
      setShowNewParty(false);
      setNewParty({ name: "", phone: "", email: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add customer");
    } finally {
      setSavingParty(false);
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
  }

  const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.rate, 0));
  const taxAmount = round2(
    lines.reduce((s, l) => s + (l.quantity * l.rate * l.taxRate) / 100, 0)
  );
  const total = round2(subtotal - discount + taxAmount);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!partyId) return setError("Please select a party.");
    const validLines = lines.filter((l) => l.description && l.quantity > 0);
    if (validLines.length === 0) return setError("Add at least one line item.");

    setSaving(true);
    try {
      await api("/api/invoices", {
        method: "POST",
        body: {
          partyId,
          type,
          discount: Number(discount) || 0,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
          items: validLines.map((l) => ({
            itemId: l.itemId || undefined,
            description: l.description,
            quantity: Number(l.quantity),
            rate: Number(l.rate),
            taxRate: Number(l.taxRate),
          })),
        },
      });
      router.push("/invoices");
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
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="SALE">Sale</option>
              <option value="PURCHASE">Purchase</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="label">Party</label>
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
              required
            >
              <option value="">Select party…</option>
              {parties.map((p) => (
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
                      <select
                        className="input mb-1"
                        value={l.itemId}
                        onChange={(e) => pickItem(i, e.target.value)}
                      >
                        <option value="">Custom / pick item…</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        placeholder="Description"
                        value={l.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                      />
                    </td>
                    <td className="table-td">
                      <input
                        type="number"
                        step="0.001"
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
                      {formatMoney(l.quantity * l.rate)}
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
          <div className="border-t border-gray-200 p-3">
            <button
              type="button"
              onClick={() => setLines([...lines, { ...blankLine }])}
              className="btn-secondary"
            >
              + Add Line
            </button>
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
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
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
        <Modal title="Add New Customer" onClose={() => setShowNewParty(false)}>
          <form onSubmit={createParty} className="space-y-4">
            <p className="text-sm text-gray-500">
              Quickly add a customer — they're saved to your customer list automatically and
              will appear next time.
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
    </div>
  );
}
