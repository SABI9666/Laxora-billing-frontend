// Product image upload for the billing app.
//
// Sends the image to the billing backend, which stores it in this project's
// Google Cloud Storage bucket and returns a public URL. This avoids any
// cross-account Firebase permissions or browser CORS issues.

import { getToken, getBusinessId } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

// Uploads one image file and returns its public URL.
export async function uploadProductImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const businessId = getBusinessId();
  if (businessId) headers["x-business-id"] = businessId;

  const res = await fetch(`${API_URL}/api/items/upload-image`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!res.ok) {
    let message = `Upload failed (HTTP ${res.status})`;
    try {
      const data = await res.json();
      // The backend returns errors as { error: "..." }; fall back to `message`
      // just in case. Without reading `error`, the real reason (file too large,
      // storage not configured, no permission) was hidden behind the generic
      // HTTP-status text above.
      if (data?.error || data?.message) message = data.error || data.message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const data = await res.json();
  return data.url as string;
}

// Generic file upload (images or PDF), e.g. a supplier's purchase bill.
export const uploadFile = uploadProductImage;
