# Deep-Tech Innovation Centre — Lab Inventory Management System

End-to-end inventory system for the Deep-Tech Innovation Centre lab (5th floor).
Covers the full physical lifecycle of a component: **receive → request → approve →
issue (handover) → return → intake back → audit ledger.**

- **Stack:** Express 5 + Prisma API · React 19 + Vite SPA · single OpenAPI contract shared by both
- **Local dev:** SQLite · **Production:** PostgreSQL 16
- **Auth:** HttpOnly session cookie, CSRF header on every mutation, argon2id password hashes,
  admin-provisioned accounts with a forced first password change

---

## 1. Monorepo layout

```
apps/
  api/            Express 5 + Prisma API (served at /api/v1)
    src/
      app.ts          express app factory (CORS, compression, request id, logging, error handler)
      server.ts       boot, graceful shutdown, process-level error handlers
      env.ts          zod-validated environment — the process refuses to boot on a bad config
      logger.ts       structured logger (JSON in production, text in dev)
      middleware/     auth session, requireAdmin, requirePasswordChanged, CSRF, rate limits
      routes/         auth, inventory, requests, issues, returns, kits, management, dashboard, allocations
    prisma/
      schema.prisma              SQLite (local dev + tests)
      schema.postgresql.prisma   PostgreSQL (production)
      seed.ts                    rough seed data — 35+ components, kits, loans, requests, ledger
  web/            React 19 + Vite SPA
    src/
      context/        AuthContext (session), LabContext (data), CartContext (request cart)
      components/     auth/ · layout/ · common/ (accessible primitives: Modal, Drawer, Badge, …)
      views/          13 screens, role-filtered
      lib/api.ts      typed API client, CSRF token handling, ApiError, idempotency ids
packages/
  contracts/      openapi.yaml (single source of truth) + generated TypeScript types
e2e/              Playwright specs that run against a real, seeded backend
docs/             domain policies, status transitions, operations runbook, deploy checklist
```

---

## 2. Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 (22 LTS recommended) |
| npm | ≥ 10 |
| PostgreSQL | 16+ — **production only**, local dev uses SQLite |

---

## 3. Quick start (Windows)

```bat
start.bat
```

This installs dependencies if needed, pushes the Prisma schema, seeds `dev.db`,
prints the seeded logins and opens <http://localhost:5173>.

### Manual start

```bash
npm install

# 1. Environment (copy and edit)
copy .env.example .env

# 2. Database + seed — must run from apps/api so Prisma resolves the relative SQLite path
npm exec --workspace=apps/api -- prisma db push --schema prisma/schema.prisma --skip-generate
npm run prisma:seed --workspace=apps/api      # tsx prisma/seed.ts

# 3. Run both servers
npm run dev            # API on :4000, web on :5173
```

`npm run dev` starts the API with `tsx watch` (auto-restart on change) and Vite.

| URL | |
|---|---|
| <http://localhost:5173> | Web app |
| <http://localhost:4000/api/v1/health/live> | Liveness probe |
| <http://localhost:4000/api/v1/health/ready> | Readiness probe (checks the DB) |

### Seeded logins

Passwords live in [apps/api/prisma/seed.ts](apps/api/prisma/seed.ts) (`Password@123` for the
local rough dataset). They only exist in the local SQLite database — no credential is bundled
into the web bundle.

The login form accepts the **College ID** (e.g. `ADMIN001`, `2024BCSE042`) and the password.
Setting `VITE_SHOW_DEMO_HINTS=true` in `.env` shows a hint block on the login screen — leave it
`false` (the default) anywhere near a real deployment.

---

## 4. Environment

See [.env.example](.env.example). Every value is validated at boot by
[apps/api/src/env.ts](apps/api/src/env.ts) — a missing `DATABASE_URL` or a `SESSION_SECRET`
shorter than 32 characters fails fast instead of silently running insecurely.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file locally, Postgres URL in production |
| `SESSION_SECRET` | Signs the session cookie — **rotate per environment, ≥ 32 chars** |
| `PORT` | API port, default `4000` |
| `NODE_ENV` | `development` / `production` / `test` |
| `APP_ORIGIN` / `WEB_ORIGIN` | Origins allowed for the API and for CORS in dev |
| `LOG_LEVEL` | `fatal` · `error` · `warn` · `info` · `debug` · `trace` |
| `VITE_SHOW_DEMO_HINTS` | `true` shows the seeded-account hint on the login screen (local only) |

> [!CAUTION]
> `VITE_*` variables are **inlined into the public JavaScript bundle**. Never put a secret in one.

---

## 5. Testing

```
npm test --workspace=apps/api       # API vitest (auth, workflows, management, password policy)
npm test --workspace=apps/web       # web vitest (AuthContext, CartContext, ErrorBoundary)
npm test --workspaces               # both
npm run test:e2e                    # Playwright — 37 tests, real backend on a dedicated e2e.db
npm run test:e2e:report             # open the last Playwright HTML report
```

---

## 6. Building

```bash
npm run build --workspaces            # api tsc, web tsc + vite build
```

Production API start:

```bash
npm run build --workspace=apps/api
npm run start --workspace=apps/api    # node dist/server.js
```

---

## 7. Regenerating the API contract

[packages/contracts/openapi.yaml](packages/contracts/openapi.yaml) is the single source of truth
for the HTTP surface. After editing it:

```bash
npm run generate:contracts            # regenerates packages/contracts/generated/api.d.ts
```

---

## 8. Domain rules (locked)

Full detail in [docs/product-decisions.md](docs/product-decisions.md) and
[docs/status-transitions.md](docs/status-transitions.md).

| Rule | |
|---|---|
| **Stock moves only at handover** | A request or approval never changes stock. `POST /issues` is the single point where quantities decrement and serialized units become `ALLOCATED`. |
| **Dual tracking modes** | `SERIALIZED` items track individual units by asset code (`ARD-003`); `BULK` items track a quantity (`jumper wires × 48`). |
| **Returnable vs consumable** | `RETURNABLE` items come back and are graded; `CONSUMABLE` items decrement permanently on issue. |
| **Kits expand** | A requested kit is expanded into individual item lines server-side — no artificial kit stock lock. |
| **Return grading** | 3-tier condition: `WORKING` (restocked) · `NEEDS_CHECKING` (quarantined as `UNAVAILABLE`) · `NOT_WORKING` (retired). |
| **Admin-provisioned accounts** | No public signup. An admin creates accounts with a temporary password and `mustChangePassword` is enforced server-side — every mutation returns `403 PASSWORD_CHANGE_REQUIRED` until it is replaced. |
| **Idempotent writes** | Stock mutations carry a `clientCommandId`; replaying it returns the original result instead of double-deducting. |
| **Immutable ledger** | `StockMovement` rows are append-only and exported as CSV from the Audit Ledger screen. |

---

## 9. Roles & screens

**Admin (Faculty In-Charge)** — Dashboard · Inventory · Request Queue · Issue Desk ·
Returns Desk · Stock Intake · Kits & Bundles · Lab Layout · Audit Ledger · Users & Projects.

**Student** — Dashboard · Browse Inventory · Cart · My Requests · My Borrowed Items ·
Kits & Bundles · Lab Layout.

Navigation is filtered by role; admin routes redirect to the dashboard for a student.

### The lab workflow

```
Admin receives stock ──► Student requests (cart / kit) ──► Admin approves or partially approves
                                                                    │
                                     Admin issues at the counter ◄───┘
                                              │
                              Student returns items, graded by condition
                                              │
                          Ledger CSV + low-stock alerts on the dashboard
```

---

## 10. API

Base path `/api/v1`. Authenticated by the `dt_session` HttpOnly cookie set at login; every
mutation additionally requires the `x-csrf-token` header (the token is returned by
`POST /auth/login` and refreshed by `PATCH /auth/password`).

22 endpoints are documented in [packages/contracts/openapi.yaml](packages/contracts/openapi.yaml):
health probes, auth (login / me / logout / password change), items, categories, locations,
stock receipts, the stock movement ledger, dashboard stats, allocations, users, projects,
requests (+ decision + cancel), kits, issues and returns.

---

## 11. Deployment
 
The production architecture is deployed across a cloud split tier:
- **Frontend**: [Vercel](https://vercel.com) (`apps/web` Vite SPA with `vercel.json` API proxy rewrites).
- **Backend**: [Render](https://render.com) (`apps/api` Express 5 REST service at `/api/v1`).
- **Production Database**: Render Managed PostgreSQL 16 (`inventory_geu_dtic`).
- **Local Dev Database**: SQLite (`dev.db`), completely isolated from the cloud database.

See [docs/operations.md](docs/operations.md) for the full runbook (Vercel + Render setup, Docker Compose alternative, migrations, backups, restore drills, rollback) and [docs/deploy-checklist.md](docs/deploy-checklist.md) for the release gate. Container images: [Dockerfile](Dockerfile) + [docker-compose.yml](docker-compose.yml).


## 12. Project docs

| Document | |
|---|---|
| [Project.md](Project.md) | Project history, frontend rebuild record, verification results |
| [docs/product-decisions.md](docs/product-decisions.md) | Locked domain policies |
| [docs/status-transitions.md](docs/status-transitions.md) | Request / allocation / unit state machines |
| [docs/domain-glossary.md](docs/domain-glossary.md) | Terminology |
| [docs/operations.md](docs/operations.md) | Production operations runbook |
| [docs/deploy-checklist.md](docs/deploy-checklist.md) | Release gate |
