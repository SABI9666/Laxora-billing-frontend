"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setToken, setBusinessId, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        auth: false,
        body: { email, password },
      });
      setToken(res.token);
      // Fetch the user's businesses to set the active one.
      const me = await api<{
        user: { memberships: { business: { id: string } }[] };
      }>("/api/auth/me");
      const first = me.user.memberships[0]?.business.id;
      if (first) setBusinessId(first);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand">Laxora Billing</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="label">Username or Email</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. laxoraperavoor"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              <a
                href="mailto:pradeeksha798@gmail.com?subject=Password%20reset%20request&body=Please%20reset%20the%20password%20for%20my%20shop%20login.%20Username:%20"
                className="text-xs font-medium text-brand hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          No account?{" "}
          <Link href="/register" className="font-medium text-brand">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
