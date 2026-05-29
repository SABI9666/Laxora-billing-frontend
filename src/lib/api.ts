// Thin fetch wrapper around the Laxora backend API.
// Handles base URL, auth token, active business header, and JSON parsing.

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

const TOKEN_KEY = "laxora_token";
const BUSINESS_KEY = "laxora_business_id";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getBusinessId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BUSINESS_KEY);
}

export function setBusinessId(id: string) {
  localStorage.setItem(BUSINESS_KEY, id);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(BUSINESS_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean; // default true
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const biz = getBusinessId();
    if (biz) headers["x-business-id"] = biz;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && typeof window !== "undefined") {
    clearSession();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Request failed", data.details);
  }
  return data as T;
}
