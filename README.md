# Laxora Billing — Frontend

Customer-facing web app for the Laxora billing SaaS. Built with **Next.js 14
(App Router) + React + TypeScript + Tailwind CSS** and designed to deploy on
**Vercel**. It talks to the [Laxora backend API](../Laxora-billing-backend)
running on Google Cloud Run.

## Features
- 🔐 Sign up / sign in (JWT stored client-side)
- 📊 Dashboard — sales, receivables, purchases, low-stock, recent invoices
- 🧾 Invoices — create sale/purchase invoices with line items, live tax & totals
- 👥 Parties — manage customers & suppliers
- 📦 Items — products/services with stock tracking
- 💰 Payments — record payments, auto-updates invoice status
- ⚙️ Settings — business profile (name, GSTIN, address, logo)

## 1. Run locally

> Prerequisite: the backend API running (default `http://localhost:8080`).

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if different
npm run dev
```
Open http://localhost:3000. Log in with the seeded demo account
(`demo@laxora.app` / `demo1234`) or create a new account.

## 2. Environment variables

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API (no trailing slash). |

## 3. Deploy to Vercel (step by step)

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Go to https://vercel.com → **Add New… → Project** → import this repo.
3. Vercel auto-detects Next.js — no build settings needed.
4. Under **Environment Variables**, add:
   ```
   NEXT_PUBLIC_API_URL = https://your-cloud-run-url.a.run.app
   ```
5. Click **Deploy**. You'll get a URL like `https://laxora-billing.vercel.app`.
6. **Important:** add that Vercel URL to the backend's `CORS_ORIGINS` env var on
   Cloud Run, then redeploy the backend, so the browser is allowed to call the API.

## 4. Project structure

```
src/
├── app/
│   ├── layout.tsx          # root layout
│   ├── page.tsx            # redirects to /dashboard or /login
│   ├── login/              # sign in
│   ├── register/           # sign up
│   └── (app)/              # authenticated area (guarded + sidebar)
│       ├── layout.tsx      # auth guard + app shell
│       ├── dashboard/
│       ├── invoices/  (+ new/)
│       ├── parties/
│       ├── items/
│       ├── payments/
│       └── settings/
├── components/             # Sidebar, Modal, PageHeader
└── lib/
    ├── api.ts              # fetch wrapper (token + business header)
    └── format.ts          # money/date formatting
```

## 5. How auth works
On login/register the API returns a JWT, stored in `localStorage` along with the
active `businessId`. The `api()` helper attaches `Authorization: Bearer <token>`
and `x-business-id` headers automatically. A 401 clears the session and bounces
to `/login`.
