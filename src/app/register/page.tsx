"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setToken, setBusinessId, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ token: string; business: { id: string } }>(
        "/api/auth/register",
        { method: "POST", auth: false, body: form }
      );
      setToken(res.token);
      setBusinessId(res.business.id);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand">Laxora Billing</h1>
          <p className="mt-1 text-sm text-gray-500">Create your account</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="label">Your name</label>
            <input className="input" value={form.name} onChange={update("name")} required />
          </div>
          <div>
            <label className="label">Business name</label>
            <input
              className="input"
              value={form.businessName}
              onChange={update("businessName")}
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={update("email")}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={update("password")}
              minLength={6}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
