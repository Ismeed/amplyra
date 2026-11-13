# Amplyra AI

**Tagline:** Your Marketing Team. Powered by AI. Amplified by Creators.

This repository contains the complete startup blueprint ([`docs/AMPLYRA_BLUEPRINT.md`](docs/AMPLYRA_BLUEPRINT.md)) and the **V1 Fullstack MVP** monorepo implementation.

## Monorepo Structure

```text
amplyra/
├── docs/AMPLYRA_BLUEPRINT.md   # Full product strategy & technical architecture blueprint
├── packages/shared/            # @amplyra/shared: enums, lifecycle state machine, post URL parser, analytics/fee split helpers
├── apps/api/                   # @amplyra/api: NestJS modular monolith + Prisma + PostgreSQL
└── apps/web/                   # @amplyra/web: Next.js 15 App Router + Tailwind CSS + TanStack Query
```

## V1 MVP Capabilities Implemented

- **Identity & RBAC (`auth`)**: Registration (`BUSINESS`, `CREATOR`), login, JWT access + rotating refresh sessions, logout, email verification token workflow.
- **Business Workspace (`businesses`)**: Profile creation/editing and dashboard KPI summary.
- **Creator Marketplace (`creators`)**: Creator profiles, social channels, portfolio items, multi-filter discovery (country, state, city, category, niche, platform, min followers, max NGN rate, availability, search query), and creator earnings tracking.
- **Campaign Engine (`campaigns`)**: Brief creation with NGN budgets in integer minor units (`kobo`), deliverables, 15-day retention defaults, backend-validated lifecycle transitions, applications, invitations, business approval -> assignment creation, creator acceptance, and public post URL submission with automatic platform & post ID detection.
- **Official Social OAuth Adapters (`social`)**: Adapter architecture for Instagram, TikTok, and Facebook with AES-256-GCM encrypted token storage and sandbox OAuth mode when platform keys are unset (never requests social passwords).
- **Campaign Verification & 5-Day Reporting (`verification`)**: Auto-scheduled Day 0 / Day 5 / Day 10 / Day 15 reporting milestones on post submission, immutable `MetricSnapshot` history, strict separation between `official_api` and `creator_evidence`, explicit denominator validation for engagement/CPV/CPE metrics, and business report flagging.
- **Protected Campaign Payments (`payments`)**: Integer `kobo` funding & payout ledger with transparent 10% platform fee / 90% creator split, Paystack checkout + HMAC-SHA512 webhook verification (plus labeled sandbox partner funding), dispute opening/resolution, and release gating against deliverables, retention dates, and active disputes.
- **AI Marketing Department (`ai`)**: Provider-independent AI adapter (Gemini / OpenAI / deterministic fallback) powering AI Marketing Strategist, Brand-Toned Content Studio, Approval-Gated Content Calendar, and Grounded AI Marketing Analyst + Recommendations.
- **Notifications & Audit Logs (`notifications`, `admin`)**: In-app notifications for campaign, report, and payment milestones plus an Admin verification, dispute resolution, and audit console.
- **Supabase Postgres & Storage (`storage`)**: Supavisor-ready Prisma configuration (`DATABASE_URL` + `DIRECT_URL`) and server-authorized Supabase Storage signed upload/download URLs across `amplyra-private` (evidence screenshots, campaign media) and `amplyra-public` (creator avatars, business logos).

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` (and optionally `apps/api/.env`).

3. **Start PostgreSQL and Redis via Docker:**
   ```bash
   docker compose up -d
   ```

4. **Generate Prisma client, push schema, and seed Nigerian SME & creator demo data:**
   ```bash
   pnpm db:generate
   pnpm --filter @amplyra/api db:push
   pnpm db:seed
   ```

5. **Run API & Web concurrently:**
   ```bash
   pnpm dev
   ```
   - Web app: `http://localhost:3000`
   - API server: `http://localhost:4000/api/v1`

## Seeded Demo Accounts

Password for all seeded accounts: `AmplyraDemo123!`

- **Business:** `founder@katsinathreadz.ng` (Katsina Threadz)
- **Creator:** `zainab@creators.amplyra.ai` (Zainab Styles — Katsina)
- **Admin:** `admin@amplyra.ai`

## Supabase Production Configuration

1. Set **PostgreSQL / Supavisor** connection strings:
   - `DATABASE_URL`: Supabase Transaction Pooler (`port 6543`, `?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL`: Supabase Direct / Session connection (`port 5432`) for `prisma db push` / `prisma migrate`
2. Set **Supabase Storage** credentials on the API server (`apps/api`):
   - `SUPABASE_URL`: `https://<project-ref>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: Server-side service role / secret key (never set as `NEXT_PUBLIC_*`)
   - `SUPABASE_STORAGE_PRIVATE_BUCKET` (default `amplyra-private`)
   - `SUPABASE_STORAGE_PUBLIC_BUCKET` (default `amplyra-public`)
3. Lock down **`public` schema RLS** after pushing schema changes or adding Prisma tables:
   ```bash
   pnpm --filter @amplyra/api exec prisma db execute --file prisma/supabase-rls.sql --schema prisma/schema.prisma
   ```
   Enables Row Level Security and revokes direct `anon`/`authenticated` Data API table privileges while keeping server-side NestJS/Prisma access working via `postgres` (`BYPASSRLS`).
