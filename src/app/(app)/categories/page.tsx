"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Category = {
  id: string;
  name: string;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  _count?: { items: number };
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState("");

  const mains = categories.filter((c) => !c.parentId);
  const subsByParent = (id: string) => categories.filter((c) => c.parentId === id);

  async function load() {
    const r = await api<{ categories: Category[] }>("/api/categories");
    setCategories(r.categories);
  }
  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setName("");
    setParentId("");
    setError("");
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setParentId(c.parentId || "");
    setError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const body = { name, parentId: parentId || null };
      if (editing) {
        await api(`/api/categories/${editing.id}`, { method: "PUT", body });
      } else {
        await api("/api/categories", { method: "POST", body });
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    }
  }

  async function remove(c: Category) {
    const subs = subsByParent(c.id).length;
    const msg = subs
      ? `Delete "${c.name}" and its ${subs} subcategor${subs === 1 ? "y" : "ies"}? Products keep existing without them.`
      : `Delete category "${c.name}"? Products keep existing without it.`;
    if (!confirm(msg)) return;
    await api(`/api/categories/${c.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        action={
          <button onClick={openNew} className="btn-primary">
            + Add Category
          </button>
        }
      />

      <div className="card p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">Name</th>
              <th className="table-th text-right">Products</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mains.map((c) => (
              <CategoryRows
                key={c.id}
                main={c}
                subs={subsByParent(c.id)}
                onEdit={openEdit}
                onRemove={remove}
              />
            ))}
            {categories.length === 0 && (
              <tr>
                <td className="table-td text-gray-400" colSpan={3}>
                  No categories yet. Add a main category (e.g. LED Lights), then add subcategories
                  (e.g. Bulb, Panel) under it.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title={editing ? "Edit Category" : "Add Category"} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-4">
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Main Category (leave blank for a top-level category)</label>
              <select
                className="input"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">— None (this is a main category) —</option>
                {mains
                  .filter((m) => m.id !== editing?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function CategoryRows({
  main,
  subs,
  onEdit,
  onRemove,
}: {
  main: Category;
  subs: Category[];
  onEdit: (c: Category) => void;
  onRemove: (c: Category) => void;
}) {
  return (
    <>
      <tr>
        <td className="table-td font-medium">{main.name}</td>
        <td className="table-td text-right">{main._count?.items ?? 0}</td>
        <td className="table-td text-right">
          <button onClick={() => onEdit(main)} className="mr-3 text-brand hover:underline">
            Edit
          </button>
          <button onClick={() => onRemove(main)} className="text-red-600 hover:underline">
            Delete
          </button>
        </td>
      </tr>
      {subs.map((s) => (
        <tr key={s.id} className="bg-slate-50/50">
          <td className="table-td pl-8 text-gray-600">↳ {s.name}</td>
          <td className="table-td text-right">{s._count?.items ?? 0}</td>
          <td className="table-td text-right">
            <button onClick={() => onEdit(s)} className="mr-3 text-brand hover:underline">
              Edit
            </button>
            <button onClick={() => onRemove(s)} className="text-red-600 hover:underline">
              Delete
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}
