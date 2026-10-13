---
name: deeptech-lab-inventory
description: >-
  Engineering protocol, navigation guide, operational procedures, and architectural rules for the Deep-Tech Innovation Centre Lab Inventory Management System.
  Activate whenever modifying, debugging, extending, refactoring, deploying, or navigating any part of the deeptech-lab-inventory codebase.
---

# Deep-Tech Lab Inventory — Engineering Protocol & Operational Skill

This skill is the authoritative operating guide for AI agents working inside the **Deep-Tech Innovation Centre Lab Inventory Management System** repository (`inventory-project`).

---

## 1. Core Architecture & Monorepo Layout

```text
inventory-project/
├── apps/
│   ├── api/            Express 5 + Prisma ORM (Port 4000 locally, Render in production)
│   │   ├── src/        Routes, middleware, auth, logger, db, server entrypoints
│   │   └── prisma/     schema.prisma (SQLite dev) & schema.postgresql.prisma (Postgres prod)
│   └── web/            React 19 + Vite 6 SPA (Port 5173 locally, Vercel in production)
│       ├── src/        13 screens, contexts (Auth, Lab, Cart), UI primitives, API client
│       └── vercel.json API proxy rewrites routing /api/* to Render backend
├── packages/
│   └── contracts/      openapi.yaml (single source of truth) + generated TypeScript types
├── e2e/                Playwright test specifications running against seeded live backend
├── docs/               operations.md, deploy-checklist.md, product-decisions.md, domain-glossary.md
├── Dockerfile          Production unified multi-stage container
└── start.bat           Windows local one-click bootstrapper
```

---

## 2. Environment & Database Isolation

A fundamental operational rule of this codebase is **strict environment and data isolation**:

| Dimension | Local Development | Cloud Production |
|---|---|---|
| **Frontend** | Vite Dev Server (`http://localhost:5173`) | Vercel (`https://...vercel.app`) |
| **Backend API** | Express (`http://localhost:4000`) | Render (`https://inventory-project-7g7s.onrender.com`) |
| **Database** | SQLite (`apps/api/prisma/dev.db`) | Render PostgreSQL 16 (`inventory_geu_dtic`) |
| **Data Scope** | Local mock/testing mutations only | Real cloud records, persistent audit trail |
| **Demo Login** | Automatic via `import.meta.env.DEV` | Enabled via `VITE_SHOW_DEMO_HINTS=true` |

---

## 3. Deployment Topology & Runbook

### Vercel (Frontend)
- **Root Directory**: `apps/web`
- **Application Preset**: `Vite`
- **Routing**: `apps/web/vercel.json` proxies all `/api/:path*` directly to the Render Web Service URL.
- **TypeScript Guard**: `apps/web/tsconfig.json` excludes test files (`*.test.tsx`) so that dev test libraries are not required during production Vercel builds.

### Render (Backend & Database)
- **Database**: Render PostgreSQL instance (`inventory_geu_dtic`).
- **Web Service Root Directory**: `[blank]` (repo root, preserves monorepo dependencies).
- **Build Command**:
  ```bash
  npm ci --include=dev && npx prisma generate --schema apps/api/prisma/schema.postgresql.prisma && npm run build --workspace=apps/api
  ```
  *Note*: `--include=dev` is mandatory so that TypeScript definitions (`@types/express`, `@types/node`) are available during build when `NODE_ENV=production`.
- **Start Command**:
  ```bash
  npx prisma db push --schema apps/api/prisma/schema.postgresql.prisma --skip-generate && npm run prisma:seed --workspace=apps/api && npm run start --workspace=apps/api
  ```
- **Required Env Variables**:
  - `DATABASE_URL`: Internal Postgres connection string
  - `NODE_ENV`: `production`
  - `SESSION_SECRET`: Random 32+ character string
  - `PORT`: `4000` (or platform default)
  - `APP_ORIGIN`: Vercel public URL

---

## 4. Domain & Workflow Guardrails (Locked Policies)

1. **Stock Decrements Only at Handover**:
   - Creating or approving a request never alters inventory balances.
   - `POST /issues` is the singular point where quantities decrement and serialized items transition to `ALLOCATED`.
2. **Dual Tracking Modes**:
   - `SERIALIZED`: Individual asset codes (`ARD-001`, `RPI-004`).
   - `BULK`: Tracked by integer quantities (e.g. `jumper wires × 48`).
3. **Return Grading**:
   - `WORKING`: Restocked back into circulation.
   - `NEEDS_CHECKING`: Quarantined as `UNAVAILABLE` (requires faculty verification).
   - `NOT_WORKING`: Permanently retired.
4. **Idempotent Operations**:
   - All state-changing mutations require a unique `clientCommandId`. Replaying a command ID must return the original result rather than re-executing stock movements.
5. **Security & Password Policy**:
   - Admin-provisioned accounts start with `mustChangePassword: true`. All mutation routes return `403 PASSWORD_CHANGE_REQUIRED` until password is rotated via `PATCH /auth/password`.
   - Passwords hashed via Argon2id. Sessions authenticated via HttpOnly cookie `dt_session`. CSRF tokens required on all non-GET mutations (`x-csrf-token`).

---

## 5. Development & Testing Commands

```bash
# Start local dev (both API on :4000 and Web on :5173)
start.bat                      # Windows one-click
npm run dev                    # CLI concurrently

# Verification commands
npm run lint --workspaces      # ESLint checks
npm run typecheck --workspaces # TypeScript check
npm test --workspaces          # Vitest suite for api and web
npm run test:e2e               # Playwright end-to-end tests
npm run build --workspaces     # Production build verification
```
