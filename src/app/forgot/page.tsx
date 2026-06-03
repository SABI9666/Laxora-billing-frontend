"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [id, setId] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        auth: false,
        body: { email: id.trim() },
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand">Forgot Password</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your username — your admin will be notified to reset it.
          </p>
        </div>

        {sent ? (
          <div className="card text-center">
            <p className="text-sm text-gray-700">
              ✅ Request sent. Your admin has been emailed and will set a new
              password for you shortly.
            </p>
            <Link href="/login" className="mt-4 inline-block font-medium text-brand">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. laxoraperavoor"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Sending…" : "Request password reset"}
            </button>
            <Link href="/login" className="block text-center text-sm text-gray-500">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
