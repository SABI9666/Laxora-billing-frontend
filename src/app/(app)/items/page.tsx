"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Category = { id: string; name: string };
type Party = { id: string; name: string; type: string };

type Item = {
  id: string;
  name: string;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  sku?: string;
  barcode?: string;
  brand?: string;
  wattage?: string;
  hsn?: string;
  unit: string;
  salePrice: string;
  purchasePrice: string;
  taxRate: string;
  stockQty: string;
  lowStockAlert: string;
  isService: boolean;
};

const empty = {
  name: "",
  categoryId: "",
  supplierId: "",
  sku: "",
  barcode: "",
  brand: "",
  wattage: "",
  hsn: "",
  unit: "PCS",
  salePrice: 0,
  purchasePrice: 0,
  taxRate: 0,
  stockQty: 0,
  lowStockAlert: 0,
  isService: false,
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  // Live client-side search across name, brand, category, SKU, barcode, wattage.
  const term = search.trim().toLowerCase();
  const visibleItems = term
    ? items.filter((it) =>
        [it.name, it.brand, it.category?.name, it.sku, it.barcode, it.wattage]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
      )
    : items;

  async function load() {
    const [r, c, p] = await Promise.all([
      api<{ items: Item[] }>("/api/items"),
      api<{ categories: Category[] }>("/api/categories"),
      api<{ parties: Party[] }>("/api/parties"),
    ]);
    setItems(r.items);
    setCategories(c.categories);
    setSuppliers(p.parties.filter((x) => x.type === "SUPPLIER"));
  }
  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(it: Item) {
    setEditing(it);
    setForm({
      ...it,
      categoryId: it.categoryId || "",
      supplierId: it.supplierId || "",
      barcode: it.barcode || "",
      brand: it.brand || "",
      wattage: it.wattage || "",
      salePrice: Number(it.salePrice),
      purchasePrice: Number(it.purchasePrice),
      taxRate: Number(it.taxRate),
      stockQty: Number(it.stockQty),
      lowStockAlert: Number(it.lowStockAlert),
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        categoryId: form.categoryId || null,
        supplierId: form.supplierId || null,
        salePrice: Number(form.salePrice),
        purchasePrice: Number(form.purchasePrice),
        taxRate: Number(form.taxRate),
        stockQty: Number(form.stockQty),
        lowStockAlert: Number(form.lowStockAlert),
        isService: !!form.isService,
      };
      if (editing) {
        const r = await api<{ pending?: boolean }>(`/api/items/${editing.id}`, {
          method: "PUT",
          body,
        });
        if (r?.pending) {
          setNotice("✅ Your change was sent to the admin for approval. It will update once approved.");
        }
      } else {
        await api("/api/items", { method: "POST", body });
      }
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(it: Item) {
    if (!confirm(`Delete ${it.name}?`)) return;
    await api(`/api/items/${it.id}`, { method: "DELETE" });
    await load();
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader
        title="Items"
        action={
          <button onClick={openNew} className="btn-primary">
            + Add Item
          </button>
        }
      />

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-amber-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <input
          className="input max-w-md"
          placeholder="🔍 Search products by name, brand, category, SKU, barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-sm text-gray-400">
          {visibleItems.length} of {items.length}
        </span>
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Category</th>
                <th className="table-th">Unit</th>
                <th className="table-th text-right">Sale Price</th>
                <th className="table-th text-right">Tax %</th>
                <th className="table-th text-right">Stock</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleItems.map((it) => {
                const low =
                  !it.isService && Number(it.stockQty) <= Number(it.lowStockAlert);
                return (
                  <tr key={it.id}>
                    <td className="table-td font-medium">
                      {it.name}
                      {it.brand ? <span className="ml-1 text-xs text-gray-400">{it.brand}</span> : null}
                    </td>
                    <td className="table-td text-gray-500">{it.category?.name || "—"}</td>
                    <td className="table-td">{it.isService ? "Service" : it.unit}</td>
                    <td className="table-td text-right">{formatMoney(it.salePrice)}</td>
                    <td className="table-td text-right">{Number(it.taxRate)}%</td>
                    <td className="table-td text-right">
                      {it.isService ? (
                        "—"
                      ) : (
                        <span className={low ? "font-semibold text-red-600" : ""}>
                          {Number(it.stockQty)}
                        </span>
                      )}
                    </td>
                    <td className="table-td text-right">
                      <button
                        onClick={() => openEdit(it)}
                        className="mr-3 text-brand hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(it)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={7}>
                    {items.length === 0 ? "No products yet." : "No products match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal title={editing ? "Edit Item" : "Add Item"} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Name</label>
                <input className="input" value={form.name} onChange={set("name")} required />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.categoryId} onChange={set("categoryId")}>
                  <option value="">— None —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Supplier (who you buy this from)</label>
              <select className="input" value={form.supplierId} onChange={set("supplierId")}>
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {suppliers.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  Add suppliers in Customers &amp; Suppliers (type Supplier) to link them here.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Brand</label>
                <input className="input" value={form.brand} onChange={set("brand")} />
              </div>
              <div>
                <label className="label">Wattage / Model</label>
                <input
                  className="input"
                  value={form.wattage}
                  onChange={set("wattage")}
                  placeholder="e.g. 9W"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">SKU</label>
                <input className="input" value={form.sku} onChange={set("sku")} />
              </div>
              <div>
                <label className="label">Barcode</label>
                <input className="input" value={form.barcode} onChange={set("barcode")} />
              </div>
              <div>
                <label className="label">HSN</label>
                <input className="input" value={form.hsn} onChange={set("hsn")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Sale Price</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.salePrice}
                  onChange={set("salePrice")}
                />
              </div>
              <div>
                <label className="label">Purchase Price</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.purchasePrice}
                  onChange={set("purchasePrice")}
                />
              </div>
              <div>
                <label className="label">Tax %</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.taxRate}
                  onChange={set("taxRate")}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.isService}
                onChange={(e) => setForm({ ...form, isService: e.target.checked })}
              />
              This is a service (no stock tracking)
            </label>
            {!form.isService && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Unit</label>
                  <input className="input" value={form.unit} onChange={set("unit")} />
                </div>
                <div>
                  <label className="label">Stock Qty</label>
                  <input
                    type="number"
                    step="0.001"
                    className="input"
                    value={form.stockQty}
                    onChange={set("stockQty")}
                  />
                </div>
                <div>
                  <label className="label">Low Stock Alert</label>
                  <input
                    type="number"
                    step="0.001"
                    className="input"
                    value={form.lowStockAlert}
                    onChange={set("lowStockAlert")}
                  />
                </div>
              </div>
            )}
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
