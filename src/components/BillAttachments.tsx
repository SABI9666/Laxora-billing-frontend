"use client";

import { useState } from "react";
import { uploadFile } from "@/lib/upload";

// Lets a user attach up to `MAX` bills/documents (photo or PDF) to an invoice.
// Files are added one at a time and listed with a Remove option.
const MAX = 3;

export default function BillAttachments({
  urls,
  onChange,
  label,
  hint,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  label: string;
  hint?: React.ReactNode;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function addFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadFile(file);
      onChange([...urls, url].slice(0, MAX));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function remove(i: number) {
    onChange(urls.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <label className="label">
        {label}{" "}
        <span className="font-normal text-gray-400">
          (photo or PDF · up to {MAX} · optional)
        </span>
      </label>

      {urls.length > 0 && (
        <ul className="mb-2 space-y-1">
          {urls.map((u, i) => (
            <li key={i} className="text-xs">
              <a
                href={u}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                ✓ File {i + 1} — view
              </a>
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-3 text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {urls.length < MAX ? (
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={addFile}
          className="block text-sm"
        />
      ) : (
        <p className="text-xs text-gray-400">Maximum {MAX} files attached.</p>
      )}
      {uploading && <p className="mt-1 text-xs text-brand">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint}
    </div>
  );
}
