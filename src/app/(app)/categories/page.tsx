"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Category = { id: string; name: string; _count?: { items: number } };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

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
    setError("");
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await api(`/api/categories/${editing.id}`, { method: "PUT", body: { name } });
      } else {
        await api("/api/categories", { method: "POST", body: { name } });
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete category "${c.name}"? Products keep existing without it.`)) return;
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
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="table-td font-medium">{c.name}</td>
                <td className="table-td text-right">{c._count?.items ?? 0}</td>
                <td className="table-td text-right">
                  <button onClick={() => openEdit(c)} className="mr-3 text-brand hover:underline">
                    Edit
                  </button>
                  <button onClick={() => remove(c)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td className="table-td text-gray-400" colSpan={3}>
                  No categories yet. Add Bulb, Panel, Strip, Driver, etc.
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
