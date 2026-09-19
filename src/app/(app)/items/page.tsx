"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { uploadProductImage } from "@/lib/upload";
import { makeProductCode, productNumberOf } from "@/lib/productCode";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import ProductHistory from "@/components/ProductHistory";

type Category = {
  id: string;
  name: string;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
};
type Party = { id: string; name: string; type: string };

type Item = {
  id: string;
  name: string;
  categoryId?: string | null;
  category?: { id: string; name: string; parentId?: string | null } | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  sku?: string;
  barcode?: string;
  brand?: string;
  wattage?: string;
  hsn?: string;
  unit: string;
  salePrice: string;
  mrp: string;
  purchasePrice: string;
  taxRate: string;
  stockQty: string;
  lowStockAlert: string;
  isService: boolean;
  description?: string | null;
  specification?: string | null;
  warranty?: string | null;
  imageUrl?: string | null;
  imageUrl2?: string | null;
  imageUrl3?: string | null;
  publishOnline: boolean;
  purchaseBillUrl?: string | null;
};

const empty = {
  name: "",
  categoryId: "",
  supplierId: "",
  productNo: "",
  sku: "",
  barcode: "",
  brand: "",
  wattage: "",
  hsn: "",
  unit: "PCS",
  salePrice: 0,
  mrp: 0,
  purchasePrice: 0,
  taxRate: 0,
  stockQty: 0,
  lowStockAlert: 0,
  isService: false,
  reason: "",
  description: "",
  specification: "",
  warranty: "",
  imageUrl: "",
  imageUrl2: "",
  imageUrl3: "",
  publishOnline: false,
  purchaseBillUrl: "",
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<any>(empty);
  // Main category selected in the form (the saved categoryId is the
  // subcategory if one is chosen, otherwise the main category).
  const [mainCategoryId, setMainCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  // Shown inside the modal when a save fails — without this, a failed save
  // left the dialog open with no feedback at all.
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  // Product whose full sale/purchase history is open in a modal.
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [search, setSearch] = useState("");

  const mainCategories = categories.filter((c) => !c.parentId);
  const subCategories = categories.filter((c) => c.parentId === mainCategoryId);

  // Live client-side search across name, brand, category, SKU, barcode, wattage.
  const term = search.trim().toLowerCase();
  const visibleItems = term
    ? items.filter(
        (it) =>
          [it.name, it.brand, it.category?.name, it.sku, it.barcode, it.wattage]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term)) ||
          // Bare product number: "9" finds BULB-009.
          (/^#?\d+$/.test(term) &&
            Number(term.replace(/^#/, "")) === Number(productNumberOf(it.sku) || NaN))
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
    setMainCategoryId("");
    setSaveError("");
    setOpen(true);
  }
  function openEdit(it: Item) {
    setEditing(it);
    // Work out which dropdown the saved category belongs in: if it has a
    // parent it's a subcategory, otherwise it's a main category.
    const cat = it.category;
    setMainCategoryId(cat ? (cat.parentId || cat.id) : "");
    setForm({
      ...empty,
      ...it,
      categoryId: it.categoryId || "",
      supplierId: it.supplierId || "",
      // A product saved without a code/barcode has null here — normalise to
      // "" so the update never sends null for a plain text field.
      sku: it.sku || "",
      // Recover the product number from a "BULB-009" style code.
      productNo: (it.sku || "").includes("-")
        ? (it.sku || "").split("-").pop() || ""
        : "",
      barcode: it.barcode || "",
      brand: it.brand || "",
      wattage: it.wattage || "",
      hsn: it.hsn || "",
      description: it.description || "",
      specification: it.specification || "",
      warranty: it.warranty || "",
      imageUrl: it.imageUrl || "",
      imageUrl2: it.imageUrl2 || "",
      imageUrl3: it.imageUrl3 || "",
      publishOnline: !!it.publishOnline,
      salePrice: Number(it.salePrice),
      mrp: Number(it.mrp),
      purchasePrice: Number(it.purchasePrice),
      taxRate: Number(it.taxRate),
      stockQty: Number(it.stockQty),
      lowStockAlert: Number(it.lowStockAlert),
    });
    setSaveError("");
    setOpen(true);
  }

  // Picking a main category clears any subcategory and makes the main the
  // saved category until a subcategory is chosen. If a product number was
  // entered, the product code follows the category (BULB + 009 → BULB-009).
  function pickMain(id: string) {
    setMainCategoryId(id);
    const catName = categories.find((c) => c.id === id)?.name;
    setForm((f: any) => ({
      ...f,
      categoryId: id,
      sku: f.productNo ? makeProductCode(catName, f.productNo) : f.sku,
    }));
  }
  // Typing a product number rebuilds the code from the selected category.
  function setProductNo(v: string) {
    const catName = categories.find((c) => c.id === mainCategoryId)?.name;
    setForm((f: any) => ({ ...f, productNo: v, sku: makeProductCode(catName, v) }));
  }
  // Picking a subcategory ("" means "use the main category only").
  function pickSub(id: string) {
    setForm((f: any) => ({ ...f, categoryId: id || mainCategoryId }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      // productNo is a form-only helper (it lives inside the SKU code).
      const { productNo: _productNo, ...formRest } = form;
      const body = {
        ...formRest,
        categoryId: form.categoryId || null,
        supplierId: form.supplierId || null,
        description: form.description || null,
        specification: form.specification || null,
        warranty: form.warranty || null,
        imageUrl: form.imageUrl || null,
        imageUrl2: form.imageUrl2 || null,
        imageUrl3: form.imageUrl3 || null,
        publishOnline: !!form.publishOnline,
        salePrice: Number(form.salePrice),
        mrp: Number(form.mrp),
        purchasePrice: Number(form.purchasePrice),
        taxRate: Number(form.taxRate),
        stockQty: Number(form.stockQty),
        lowStockAlert: Number(form.lowStockAlert),
        isService: !!form.isService,
        // Why the change was made — shown on the Edit History page.
        reason: form.reason?.trim() || undefined,
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
    } catch (err) {
      // Surface exactly why the save failed (e.g. which field was rejected).
      if (err instanceof ApiError) {
        const details = err.details as
          | { fieldErrors?: Record<string, string[]> }
          | undefined;
        const fields = details?.fieldErrors
          ? Object.entries(details.fieldErrors)
              .map(([k, v]) => `${k}: ${v.join(", ")}`)
              .join(" · ")
          : "";
        setSaveError(fields ? `${err.message} — ${fields}` : err.message);
      } else {
        setSaveError("Could not save. Please check your internet connection and try again.");
      }
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
        title="Products"
        action={
          <button onClick={openNew} className="btn-primary">
            + Add Product
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
                <th className="table-th"></th>
                <th className="table-th">Name</th>
                <th className="table-th">Category</th>
                <th className="table-th">Online</th>
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
                    <td className="table-td">
                      {it.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.imageUrl}
                          alt={it.name}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                          🖼
                        </div>
                      )}
                    </td>
                    <td className="table-td font-medium">
                      {it.name}
                      {it.brand ? <span className="ml-1 text-xs text-gray-400">{it.brand}</span> : null}
                      {it.sku ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                          {it.sku}
                        </span>
                      ) : null}
                    </td>
                    <td className="table-td text-gray-500">{it.category?.name || "—"}</td>
                    <td className="table-td">
                      {it.publishOnline ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                          Live
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Off</span>
                      )}
                    </td>
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
                        onClick={() => setHistoryItem(it)}
                        className="mr-3 text-slate-500 hover:text-brand hover:underline"
                        title="When was this sold and purchased — full details"
                      >
                        📜 History
                      </button>
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
                  <td className="table-td text-gray-400" colSpan={8}>
                    {items.length === 0 ? "No products yet." : "No products match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {historyItem && (
        <ProductHistory
          itemId={historyItem.id}
          itemName={historyItem.name}
          onClose={() => setHistoryItem(null)}
        />
      )}

      {open && (
        <Modal title={editing ? "Edit Product" : "Add Product"} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Name</label>
                <input className="input" value={form.name} onChange={set("name")} required />
              </div>
              <div>
                <label className="label">Brand</label>
                <input className="input" value={form.brand} onChange={set("brand")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Main Category</label>
                <select
                  className="input"
                  value={mainCategoryId}
                  onChange={(e) => pickMain(e.target.value)}
                >
                  <option value="">— None —</option>
                  {mainCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Subcategory</label>
                <select
                  className="input"
                  value={subCategories.some((c) => c.id === form.categoryId) ? form.categoryId : ""}
                  onChange={(e) => pickSub(e.target.value)}
                  disabled={!mainCategoryId || subCategories.length === 0}
                >
                  <option value="">
                    {subCategories.length === 0 ? "— No subcategories —" : "— None —"}
                  </option>
                  {subCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Everything the customer reads on the website, kept together so
                it is obvious which fields are shop-facing and which are not. */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-slate-700">Website listing</h3>
                <span className="text-xs text-slate-400">
                  What customers see on Laxorashopping
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="A couple of lines about the product — what it is, where it is used, what makes it worth buying."
                    value={form.description}
                    onChange={set("description")}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Shown under the price. {form.description.trim().length} characters
                    {form.description.trim().length > 0 && form.description.trim().length < 40
                      ? " — a little more detail reads better online."
                      : ""}
                  </p>
                </div>

                <div>
                  <label className="label">Specifications</label>
                  <textarea
                    className="input font-mono text-[13px]"
                    rows={4}
                    placeholder={"Material: Aluminium\nBeam angle: 120°\nColour temperature: 3000K warm white\nIP rating: IP65"}
                    value={form.specification}
                    onChange={set("specification")}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    One per line as <span className="font-semibold">Label: Value</span> — the
                    website turns these into a neat specification table. Brand, model, product
                    code and category are added automatically, so no need to repeat them.
                  </p>
                  <SpecPreview value={form.specification} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Warranty</label>
                    <input
                      className="input"
                      placeholder="e.g. 2 years, 6 months, No warranty"
                      value={form.warranty}
                      onChange={set("warranty")}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Left blank, the website simply leaves warranty out.
                    </p>
                  </div>
                  <div>
                    <label className="label">Discount shown online</label>
                    <DiscountPreview mrp={Number(form.mrp)} price={Number(form.salePrice)} />
                  </div>
                </div>

                <div>
                  <label className="label">Product Images</label>
                  <div className="grid grid-cols-3 gap-3">
                    <ImageField value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
                    <ImageField value={form.imageUrl2} onChange={(v) => setForm({ ...form, imageUrl2: v })} />
                    <ImageField value={form.imageUrl3} onChange={(v) => setForm({ ...form, imageUrl3: v })} />
                  </div>
                </div>
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
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="label">Wattage / Model</label>
                <input className="input" value={form.wattage} onChange={set("wattage")} placeholder="e.g. 9W" />
              </div>
              <div>
                <label className="label">Product No.</label>
                <input
                  className="input"
                  placeholder="e.g. 009"
                  value={form.productNo}
                  onChange={(e) => setProductNo(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Product Code (SKU)</label>
                <input className="input" value={form.sku} onChange={set("sku")} placeholder="BULB-009" />
                {form.productNo && (
                  <p className="mt-1 text-xs text-gray-400">
                    Built from category + number — editable.
                  </p>
                )}
              </div>
              <div>
                <label className="label">Barcode</label>
                <input className="input" value={form.barcode} onChange={set("barcode")} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="label">Sale Price</label>
                <input type="number" step="0.01" className="input" value={form.salePrice} onChange={set("salePrice")} />
              </div>
              <div>
                <label className="label">M.R.P. (strike)</label>
                <input type="number" step="0.01" className="input" value={form.mrp} onChange={set("mrp")} />
              </div>
              <div>
                <label className="label">Purchase Price</label>
                <input type="number" step="0.01" className="input" value={form.purchasePrice} onChange={set("purchasePrice")} />
              </div>
              <div>
                <label className="label">Tax %</label>
                <input type="number" step="0.01" className="input" value={form.taxRate} onChange={set("taxRate")} />
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
                  <input type="number" step="0.001" className="input" value={form.stockQty} onChange={set("stockQty")} />
                </div>
                <div>
                  <label className="label">Low Stock Alert</label>
                  <input type="number" step="0.001" className="input" value={form.lowStockAlert} onChange={set("lowStockAlert")} />
                </div>
              </div>
            )}

            {form.purchaseBillUrl && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                📄 Supplier purchase bill:{" "}
                <a
                  href={form.purchaseBillUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  view
                </a>
                <span className="ml-1 text-xs text-gray-400">
                  (from the latest purchase entry with a bill uploaded)
                </span>
              </div>
            )}

            <label className="flex items-center gap-2 rounded-lg bg-brand-light px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={!!form.publishOnline}
                onChange={(e) => setForm({ ...form, publishOnline: e.target.checked })}
              />
              <span>
                <span className="font-medium">Show this product on the website</span>
                <span className="block text-xs text-gray-500">
                  When on, the Laxorashopping site lists this product with its images and this
                  shop&apos;s live stock; online orders reduce that stock automatically.
                </span>
              </span>
            </label>

            {editing && (
              <div>
                <label className="label">Reason for this change (optional)</label>
                <input
                  className="input"
                  placeholder="e.g. supplier rate increased"
                  value={form.reason}
                  onChange={set("reason")}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Saved with the edit and shown on the Edit History page.
                </p>
              </div>
            )}
            {saveError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
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


// Shows the shop owner the spec table the website will build from what they
// typed, so a mistyped line is obvious before saving rather than after.
function SpecPreview({ value }: { value: string }) {
  const rows = parseSpecLines(value);
  if (rows.length === 0) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <p className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Preview on the website
      </p>
      <dl className="divide-y divide-slate-100">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-3 px-3 py-1.5 text-sm">
            <dt className="w-40 shrink-0 text-slate-500">{r.label}</dt>
            <dd className="font-medium text-slate-800">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// "Label: Value" per line. A line with no colon is kept as a plain point, so
// nothing a shop owner types is silently thrown away.
function parseSpecLines(value: string): { label: string; value: string }[] {
  return (value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(":");
      if (at <= 0) return { label: "", value: line };
      return { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
    })
    .filter((r) => r.label || r.value);
}

// The discount the customer will see is the gap between M.R.P. and sale price
// — easy to get wrong silently, so it is spelled out while editing.
function DiscountPreview({ mrp, price }: { mrp: number; price: number }) {
  if (!mrp || mrp <= price) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">
        No discount badge — set an M.R.P. above the sale price to show one.
      </div>
    );
  }
  const pct = Math.round((1 - price / mrp) * 100);
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
      <span className="font-bold text-emerald-700">{pct}% OFF</span>
      <span className="ml-2 text-slate-500">
        <span className="line-through">{formatMoney(mrp)}</span> → {formatMoney(price)}
      </span>
    </div>
  );
}

// One image slot: shows a preview, lets you upload a file (to Firebase Storage)
// or paste an image URL, and clear it.
function ImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image is larger than 5 MB — please use a smaller image.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError("");
    try {
      const url = await uploadProductImage(file);
      onChange(url);
    } catch (err) {
      // Surface the real reason (e.g. a CORS or permission error) so it can be
      // fixed, while still letting the user paste a URL as a fallback.
      console.error("Image upload failed:", err);
      setError(
        (err instanceof Error ? err.message : "Upload failed") +
          " — or paste an image URL below."
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-2">
      <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded bg-slate-50">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-2xl text-slate-300">🖼</span>
        )}
      </div>
      <input type="file" accept="image/*" onChange={onFile} className="block w-full text-xs" />
      <input
        className="input mt-1 text-xs"
        placeholder="or paste image URL"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {uploading && <p className="mt-1 text-xs text-brand">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mt-1 text-xs text-red-600 hover:underline"
        >
          Remove
        </button>
      )}
    </div>
  );
}
