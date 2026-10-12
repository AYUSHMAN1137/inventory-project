# Deep-Tech Lab Inventory — Production Readiness Plan

> **Goal:** Is project ko demo se hata ke *production-grade* banana hai, aur locally **"final deployment se ek step pehle"** ka level tak pahunchana hai.
> Ye plan batata hai **kya hatana hai, kya rakhna hai, kya naya banana hai**. Approval ke baad hi kaam shuru karunga.

---

## 1. Tumhari constraints — locked

| Tumhari baat | Iska matlab plan me |
|---|---|
| "demo point of view se bas banaya hai, wo nahi karna" | Saari **demo shortcut / fake login / role switcher** hatengi |
| "login screen pe jo easy hai wo rahene deta hoon" | **Login screen ka design aur easy flow rahega** — sirf one-click bypass hatenga |
| "jo rough data hai wo rakhna hai" | **Seed data (35+ components, loans, pending requests, ledger history) rahega** |
| "admin view / student view switcher ka kaam thodi hai" | Topbar wala **1-click role-switch button hatenga** (asli logout → login rahega) |
| "final deployment se ek step pehele local complete" | Code + config + tests + docs sab green; sirf **actual server pe deploy** baad me |

---

## 2. Verdict — KEEP / REMOVE / ADD

### 2.1 KEEP (solid hai, chhedna nahi)

| Cheez | Kyun keep |
|---|---|
| Poore 13 views (Dashboard, Catalog, Kits, Locations, Cart, MyRequests, MyLoans, RequestsQueue, Handover, Returns, Intake, Ledger, People) | End-to-end workflow cover karte hain |
| Dual-mode domain model (SERIALIZED asset codes + BULK quantities) | Product ka core |
| Hierarchical 5th-floor storage (Lab → Room → Cabinet → Shelf → Drawer → Bin) | Physical lab mapping sahi hai |
| Atomic counter handover + idempotency (`clientCommandId`) | Production-grade behaviour |
| 3-tier returns grading (WORKING / NEEDS_CHECKING / NOT_WORKING) | Domain policy locked |
| Session auth: HttpOnly `dt_session`, CSRF header, `requireAdmin`, rate-limited login | Security sahi hai |
| Login screen ka look + College ID/Password form | Tum explicitly bola easy rakhna hai |
| Rough seed data | Tum explicitly bola rakhna hai |
| SQLite dev DB + Postgres prod schema + Docker + Compose + CI + ops runbook | Deployment ke liye ready hai |
| Playwright E2E (5 spec files, real backend `e2e.db`) | Asli safety net |
| `docs/` domain policies (product-decisions, status-transitions, domain-glossary, operations) | Spec freeze hai |

### 2.2 REMOVE (ye hatana zaroori hai)

| # | Kya | Kahan | Risky kyun |
|---|---|---|---|
| R1 | `loginAs()` + `switchIdentity()` + `DEMO_PASSWORD` | [AuthContext.tsx](file:///c:/Users/ayush_lr8ru2y/Desktop/inventory%20project/apps/web/src/context/AuthContext.tsx#L11-L24) aur [L69-L98](file:///c:/Users/ayush_lr8ru2y/Desktop/inventory%20project/apps/web/src/context/AuthContext.tsx#L69-L98) | **Password frontend me hardcoded** — koi bhi JS bundle khol ke admin ban sakta hai. Ye #1 production blocker |
| R2 | "Demo accounts · one click to enter" buttons | [LoginScreen.tsx](file:///c:/Users/ayush_lr8ru2y/Desktop/inventory%20project/apps/web/src/components/auth/LoginScreen.tsx#L150-L183) | Auth bypass — production me accept hi nahi hoga |
| R3 | Topbar ka "Student view / Admin view" switch button | [Topbar.tsx](file:///c:/Users/ayush_lr8ru2y/Desktop/inventory%20project/apps/web/src/components/layout/Topbar.tsx#L113-L126) | Tumhara hi point — "iska kaam thodi hai" |
| R4 | `Password@123` string web src se | [LoginScreen.tsx](file:///c:/Users/ayush_lr8ru2y/Desktop/inventory%20project/apps/web/src/components/auth/LoginScreen.tsx#L5) + [AuthContext.tsx](file:///c:/Users/ayush_lr8ru2y/Desktop/inventory%20project/apps/web/src/context/AuthContext.tsx#L24) | Secret leak |
| R5 | Loose `any` types | [DashboardView.tsx](file:///c:/Users/ayush_lr8ru2y/Desktop/inventory%20project/apps/web/src/views/DashboardView.tsx#L27-L32) (`{ m: any }`, `tone as any`); [IntakeView.tsx](file:///c:/Users/ayush_lr8ru2y/Desktop/inventory%20project/apps/web/src/views/IntakeView.tsx#L94-L102) (`e.target.value as any` ×2) | Type safety tut-ti hai — prod me bug chhupega |
| R6 | `kits.ts` me blind `req.body` + `(i: any)` | [kits.ts](file:///c:/Users/ayush_lr8ru2y/Desktop/inventory%20project/apps/api/src/routes/kits.ts#L35-L51) | **No zod validation** — koi bhi payload DB tak pahunch sakta hai |
| R7 | Dead dependencies | `@tanstack/react-query`, `clsx`, `tailwind-merge`, `react-hook-form` (web) — **ek bhi import nahi**; `express-session`, `csrf-csrf`, `connect-session-knex` (api) — **ek bhi import nahi** | `npm audit` surface bada, install slow, confusion |
| R8 | `cookies.txt` (Netscape cookie dump) | repo root | Git me commit hua junk / potential credential leak |
| R9 | Stale docs + build junk | `implementation-plan-report.md`, `docs/frontend-upgrade-research.md`, `docs/frontend-revamp-plan.md`, `playwright-report/`, `test-results/`, committed `seed.js` / `seed.d.ts` / `seed.js.map` | Confusion; seed JS stale ho sakta hai |
| R10 | `apps/api/prisma/dev.db` git me tracked | binary DB | Har seed change pe binary diff; local artifact hona chahiye |

### 2.3 ADD (naya banana hai — production blockers)

| # | Kya | Kyun critical |
|---|---|---|
| A1 | **Forced password-change flow** (endpoint + UI) | Abhi state: admin user banata hai `mustChangePassword: true` ke saath, DB me flag set hota hai, `/auth/me` me expose hota hai — **lekin change karne ka koi zariya hi nahi**. Matlab admin-provisioned temp password kabhi rotate nahi ho sakta. **Asli production blocker** |
| A2 | **Env validation server boot pe** (zod on `process.env`) | `SESSION_SECRET` / `DATABASE_URL` missing ho to app chup-chaap chal jaata hai aur prod me silently toot-taa hai |
| A3 | **`.env.example`** | Naye dev ko pata hi nahi kya set karna hai; rotation baseline |
| A4 | **Structured logging + request log + graceful shutdown** | Abhi `console.log` / `console.error`. Chahiye: JSON logger, request id, `unhandledRejection` / `uncaughtException` / `SIGTERM` handlers, Prisma disconnect |
| A5 | **`compression` middleware** | Express abhi gzip nahi karta — sirf reverse proxy pe bharosa |
| A6 | **React Error Boundary** | Ek render crash → poori app white screen. Production me ye nahi ho sakta |
| A7 | **Frontend tests (vitest)** | `apps/web/package.json` me `"test": "vitest run"` hai, setup file bhi hai, **lekin ek test file nahi** — `npm test` **exit 1** deta hai. CI isliye web tests silently skip kar raha hai. **Hidden red flag** |
| A8 | **OpenAPI contract complete** | `openapi.yaml` me sirf 13 paths hain; asli API me ~24 endpoints (issues, returns, dashboard, allocations, users, projects, stock-receipts, stock-movements sab missing) |
| A9 | **Real README.md** | Abhi koi README nahi — setup, run, test, deploy ek jagah chahiye |
| A10 | **Accessibility pass** | Modals me `role="dialog"` / `aria-modal` / Escape / focus trap nahi; `aria-live` error announce nahi hota. `modern-web-guidance` ke forms + accessibility guides isko explicitly maangte hain |
| A11 | **`mustChangePassword` server-side enforce** | Mutations 403 jab tak password change na ho (UI par hi bharosa nahi) |
| A12 | **E2E for naye flows** | Password-change spec + demo-removal verify |

---

## 3. Execution order

### Phase 1 — Demo hatana (chhota, high impact)
1. `AuthContext.tsx` se `loginAs` / `switchIdentity` / `DEMO_*` nikalo → sirf `login` / `logout` / session restore
2. `LoginScreen.tsx` se one-click buttons + hardcoded password nikalo; form as-is; chhota "demo credentials" note **sirf dev me** (env-controlled)
3. `Topbar.tsx` se role-switch button nikalo (Sign out rahega)
4. Verify: web src me `Password@123` zero, typecheck + build green

### Phase 2 — Security & auth completion
5. `PATCH /api/v1/auth/password`: zod (current + new + confirm), argon2 verify, min-length/complexity, reuse block, `mustChangePassword: false`, baaki sessions revoke, audit event
6. `requirePasswordChanged` middleware → mutations 403 jab tak flag true
7. `ChangePasswordScreen` + app gate (`mustChangePassword` true ho to koi route render na ho)
8. API tests: happy path, wrong current, weak new, reuse, session revoke

### Phase 3 — Backend hardening
9. zod env schema (`DATABASE_URL`, `SESSION_SECRET` ≥32 chars, `NODE_ENV`, `PORT`, `APP_ORIGIN`) — boot pe fail
10. Structured logger + request logging + prod-safe error handler
11. `compression` add
12. Graceful shutdown (SIGTERM/SIGINT + unhandled rejection)
13. `kits.ts` zod schema; `req.body` typed; baaki routes audit
14. Dead deps remove + `npm audit --omit=dev` clean

### Phase 4 — Frontend quality
15. `any` types hatao (`DashboardView`, `IntakeView`) — real types
16. Error boundary + error states
17. Modal a11y: `role="dialog"`, `aria-modal`, Escape, focus trap, focus return
18. `aria-live` error announcements, label association audit, tap targets

### Phase 5 — Tests & contracts
19. Vitest pehle tests: AuthContext (login/logout/session restore), CartContext, render smoke test
20. OpenAPI saare 24 endpoints + schemas; regenerate `api.d.ts`
21. E2E: password-change + demo-removal spec; poora Playwright suite locally green

### Phase 6 — Repo hygiene & docs
22. `cookies.txt` delete, junk docs delete, committed seed `.js/.d.ts/.map` delete, `dev.db` untrack
23. `.env.example` + real `README.md` (setup / run / test / deploy)
24. `docs/deploy-checklist.md` — final gate

### Phase 7 — Final verification (deployment se ek step pehle)
```bash
npm run lint
npm run typecheck
npm test --workspaces        # API 10/10 + naye web tests
npm run build --workspaces
npx playwright test          # E2E green
npm audit --omit=dev
```

---

## 4. Jo main **nahi** chhedunga

- **Login screen ka design/UX** — easy rahega, sirf bypass hatenga
- **Seed/rough data** — as-is rahega
- **Domain rules** — stock sirf issue pe badlega, kits expand honge, serialized vs bulk dual-mode rahega (locked in `docs/product-decisions.md`)
- **View structure / navigation** — 13 views aur role-based nav rahega
- **Database schema** — Postgres/SQLite split rahega

---

## 5. Tumse 2 chhote confirmations

1. Login screen pe **"Demo credentials" hint** rakhun (sirf dev me, env se control) ya bilkul blank?
2. E2E suite abhi chalau locally (dev servers band karne padenge — 4000/5173 conflict) ya pehle typecheck/build/test se verify kar lun?

---

**Approve karo to Phase 1 se shuru karta hoon. Pehle plan, baad me kaam — jaisa tumne kaha.**
