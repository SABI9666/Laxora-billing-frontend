"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Item = { id: string; name: string; sku?: string | null; unit: string; stockQty: string };
type Movement = {
  id: string;
  type: string;
  quantity: string;
  balanceAfter: string;
  reason?: string | null;
  reference?: string | null;
  createdAt: string;
  item: { id: string; name: string; unit: string };
};
type LowItem = {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  stockQty: string;
  lowStockAlert: string;
};
type Shop = { id: string; name: string; code?: string | null };

const TYPE_BADGE: Record<string, string> = {
  IN: "bg-green-100 text-green-700",
  OUT: "bg-red-100 text-red-700",
  ADJUST: "bg-amber-100 text-amber-700",
  TRANSFER_IN: "bg-blue-100 text-blue-700",
  TRANSFER_OUT: "bg-indigo-100 text-indigo-700",
};

export default function StockPage() {
  const [tab, setTab] = useState<"movements" | "low">("movements");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [low, setLow] = useState<LowItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [error, setError] = useState("");

  const [adjust, setAdjust] = useState({ itemId: "", type: "IN", quantity: 0, reason: "" });
  const [transfer, setTransfer] = useState({ itemId: "", toBusinessId: "", quantity: 0, reason: "" });

  async function load() {
    const [m, l, it] = await Promise.all([
      api<{ movements: Movement[] }>("/api/stock/movements"),
      api<{ items: LowItem[] }>("/api/stock/low"),
      api<{ items: Item[] }>("/api/items"),
    ]);
    setMovements(m.movements);
    setLow(l.items);
    setItems(it.items.filter((x) => x));
    // Other shops in the franchise (for transfers).
    try {
      const me = await api<{ user: { memberships: { business: Shop }[] } }>("/api/auth/me");
      setShops(me.user.memberships.map((x) => x.business));
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/stock/adjust", {
        method: "POST",
        body: { ...adjust, quantity: Number(adjust.quantity) },
      });
      setAdjustOpen(false);
      setAdjust({ itemId: "", type: "IN", quantity: 0, reason: "" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed");
    }
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/stock/transfer", {
        method: "POST",
        body: { ...transfer, quantity: Number(transfer.quantity) },
      });
      setTransferOpen(false);
      setTransfer({ itemId: "", toBusinessId: "", quantity: 0, reason: "" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Stock"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setTransferOpen(true)}>
              ⇄ Transfer
            </button>
            <button className="btn-primary" onClick={() => setAdjustOpen(true)}>
              + Stock In / Adjust
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 flex gap-2">
        {(["movements", "low"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-brand text-white" : "bg-white text-gray-600"
            }`}
          >
            {t === "movements" ? "Movement Ledger" : `Low Stock (${low.length})`}
          </button>
        ))}
      </div>

      {tab === "movements" ? (
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th">Product</th>
                  <th className="table-th">Type</th>
                  <th className="table-th text-right">Qty</th>
                  <th className="table-th text-right">Balance</th>
                  <th className="table-th">Reason / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="table-td">{formatDate(m.createdAt)}</td>
                    <td className="table-td font-medium">{m.item.name}</td>
                    <td className="table-td">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          TYPE_BADGE[m.type] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td
                      className={`table-td text-right ${
                        Number(m.quantity) < 0 ? "text-red-600" : "text-green-700"
                      }`}
                    >
                      {Number(m.quantity) > 0 ? "+" : ""}
                      {Number(m.quantity)}
                    </td>
                    <td className="table-td text-right">{Number(m.balanceAfter)}</td>
                    <td className="table-td text-gray-500">
                      {m.reason}
                      {m.reference ? ` · ${m.reference}` : ""}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td className="table-td text-gray-400" colSpan={6}>
                      No stock movements yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Product</th>
                  <th className="table-th">SKU</th>
                  <th className="table-th text-right">On hand</th>
                  <th className="table-th text-right">Reorder level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {low.map((it) => (
                  <tr key={it.id}>
                    <td className="table-td font-medium">{it.name}</td>
                    <td className="table-td text-gray-500">{it.sku || "—"}</td>
                    <td className="table-td text-right font-semibold text-red-600">
                      {Number(it.stockQty)} {it.unit}
                    </td>
                    <td className="table-td text-right">{Number(it.lowStockAlert)}</td>
                  </tr>
                ))}
                {low.length === 0 && (
                  <tr>
                    <td className="table-td text-gray-400" colSpan={4}>
                      Everything is above its reorder level. 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adjustOpen && (
        <Modal title="Stock In / Adjust" onClose={() => setAdjustOpen(false)}>
          <form onSubmit={submitAdjust} className="space-y-4">
            <div>
              <label className="label">Product</label>
              <select
                className="input"
                value={adjust.itemId}
                onChange={(e) => setAdjust({ ...adjust, itemId: e.target.value })}
                required
              >
                <option value="">Select product…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} (stock {Number(it.stockQty)})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={adjust.type}
                  onChange={(e) => setAdjust({ ...adjust, type: e.target.value })}
                >
                  <option value="IN">Stock In</option>
                  <option value="OUT">Stock Out</option>
                  <option value="ADJUST">Adjust (+/-)</option>
                </select>
              </div>
              <div>
                <label className="label">Quantity</label>
                <input
                  type="number"
                  step="0.001"
                  className="input"
                  value={adjust.quantity}
                  onChange={(e) => setAdjust({ ...adjust, quantity: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Reason</label>
              <input
                className="input"
                placeholder="e.g. New purchase, damage, count correction"
                value={adjust.reason}
                onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setAdjustOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {transferOpen && (
        <Modal title="Transfer Stock to Another Shop" onClose={() => setTransferOpen(false)}>
          <form onSubmit={submitTransfer} className="space-y-4">
            <div>
              <label className="label">Product</label>
              <select
                className="input"
                value={transfer.itemId}
                onChange={(e) => setTransfer({ ...transfer, itemId: e.target.value })}
                required
              >
                <option value="">Select product…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} (stock {Number(it.stockQty)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Destination shop</label>
              <select
                className="input"
                value={transfer.toBusinessId}
                onChange={(e) => setTransfer({ ...transfer, toBusinessId: e.target.value })}
                required
              >
                <option value="">Select shop…</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.code ? ` (${s.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantity</label>
              <input
                type="number"
                step="0.001"
                className="input"
                value={transfer.quantity}
                onChange={(e) => setTransfer({ ...transfer, quantity: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="label">Reason</label>
              <input
                className="input"
                value={transfer.reason}
                onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setTransferOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Transfer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
