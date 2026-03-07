# Personal Finance Forecasting App (Next.js + Neon)

Prediction-first personal finance planner based on your PRD:
- Past months use real expenses
- Current month uses real + expected
- Future months use expectations
- Card payments follow month+1 (paid on the 4th) logic

## Stack

- Next.js (App Router)
- Prisma ORM
- Neon Postgres
- Deployable on Vercel free tier

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

Set:
- `DATABASE_URL` to Neon pooled (PgBouncer) connection string
- `DIRECT_URL` to Neon direct (non-pooled) connection string

3. Push schema to database:

```bash
npm run db:push
npm run db:generate
```

4. Run locally:

```bash
npm run dev
```

## Features Implemented

- Credit card management (create, activate/deactivate, currency)
- Expense CRUD (add, edit, delete, filter by card/month)
- Income sources with effective month ranges
- Fixed recurring expenses with effective month ranges
- Expected card spending by month (+ repeat for next N months)
- Daily exchange rate storage (manual + external fetch endpoint)
- Projection engine for 24 months
- Dashboard, card tracker, expense log, and forecast views

## Exchange Rate Automation

- Endpoint: `GET/POST /api/exchange-rates/fetch`
- Configure provider via:
  - `DOLARITO_API_URL`
  - `DOLARITO_API_KEY` (optional)
- `vercel.json` includes a daily cron trigger.

## Notes

- All financial projections are normalized to USD.
- ARS values are converted using latest known rate on or before the target date.
- No bank integrations or multi-user logic in v1.
- Prisma runtime queries use `DATABASE_URL` (pooled), while schema operations like `db push` use `DIRECT_URL`.
- Runtime code auto-adds `pgbouncer=true` to `DATABASE_URL` if missing.
