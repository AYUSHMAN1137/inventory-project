# Deep-Tech Innovation Centre — Lab Inventory Management System

> **Status (2026-10-13): Live Cloud Split Deployment (Vercel + Render + PostgreSQL) fully operational with local dev parity.**
> - Frontend deployed to **Vercel** (`apps/web` Vite SPA with `vercel.json` API proxy rewrites).
> - Backend deployed to **Render** (`apps/api` Express 5 REST API on Node 22).
> - Production database running on **Render PostgreSQL 16** (`inventory_geu_dtic`).
> - Local development remains 100% isolated using SQLite (`dev.db`).
> - One-Click Demo Logins enabled seamlessly in local dev (`import.meta.env.DEV`) and via `VITE_SHOW_DEMO_HINTS=true` in production.

## 0. Cloud Split Deployment & Environment Parity — 2026-10-13

### Architecture & Live Verification
- **Frontend (Vercel)**: Deployed from monorepo directory `apps/web`. Uses Vite SPA preset. `vercel.json` provides transparent proxy rewrites forwarding `/api/:path*` to the Render backend, preserving HttpOnly session cookies and CSRF protection without cross-origin friction.
- **Backend (Render Web Service)**: Deployed at `https://inventory-project-7g7s.onrender.com`. Monorepo root build command incorporates `--include=dev` to ensure `@types/*` are present for production TypeScript compilation.
- **Database (Render PostgreSQL)**: Automated schema sync and seed execution integrated into start command (`npx prisma db push --schema apps/api/prisma/schema.postgresql.prisma --skip-generate && npm run prisma:seed --workspace=apps/api && npm run start --workspace=apps/api`).
- **Data Parity & Isolation**:
  - `Local`: SQLite `apps/api/prisma/dev.db` for safe, off-cloud testing.
  - `Cloud`: PostgreSQL `inventory_geu_dtic` for persistent production records.
- **One-Click Demo Authentication**: Restored quick-login cards for Dr. R. K. Verma (`ADMIN001`) and Ayush Sharma (`2024BCSE042`), configured to render automatically in dev environments (`import.meta.env.DEV`) and conditionally in production (`VITE_SHOW_DEMO_HINTS=true`).

---

## 0.1 Frontend Rebuild — 2026-10-10

### E2E test suite + responsive fixes (same day)

The stale Playwright spec (`e2e/shell.spec.ts`) targeted the deleted UI and 2 of its
3 tests failed. It was replaced with a real suite that runs against the **live**
backend (no API mocking).

**Harness**
- `playwright.config.ts` starts two webServers: `e2e/start-api.mjs` (creates and
  seeds a dedicated `apps/api/prisma/e2e.db`, then boots the API on :4000) and the
  Vite dev server on :5173. `dev.db` is never touched.
- `e2e/reset-db.ts` clears and re-seeds the E2E database in each spec's `beforeAll`,
  so files are order-independent — the intake spec can create items without
  breaking the catalogue spec.
- `e2e/helpers.ts` centralises login/logout, prefix-matching sidebar navigation
  (links carry badge counts), and overlay/footer targeting.

**Coverage — 32 tests across 4 specs, all passing**
| Spec | Covers |
|---|---|
| `auth.spec.ts` (8) | Signed-out gate, invalid credentials, login, session survives reload, logout clears session, role separation, admin-route protection, every admin screen renders |
| `catalog.spec.ts` (11) | Catalogue load, search, category/nature filters, card↔table toggle, detail drawer, student cart → submit, quantity editing, validation error, admin approve/reject |
| `lifecycle.spec.ts` (2) | Full chain with **stock assertions**: request → approve (stock unchanged) → issue (stock −1) → return (stock restored); ledger rows + CSV download |
| `admin.spec.ts` (11) | Kits + BOM, kit → cart, layout drill-down, intake receipt verified against stock, new catalogue item, users/projects, responsive behaviour |

**Two real bugs found and fixed by the tests**

1. **Mobile layout overflowed 145px on every screen** — the app was unusable on a
   phone. The fixed 256px sidebar had no mobile behaviour and the topbar never
   wrapped. Fixed with a slide-over drawer (`data-testid="mobile-nav"`) below `lg`,
   a menu button, a wrapping topbar, and `overflow-x-auto` table wrappers. Verified
   overflow is now 0px on every screen at 390×844.
2. **Form labels were not associated with their inputs** (no `htmlFor`/`id`) in the
   intake modal and elsewhere, so `getByLabel` could not resolve them — a genuine
   accessibility defect. Fixed in `IntakeView`; also added `aria-label`s to the
   icon-only cart quantity/remove buttons and the topbar controls.

### Frontend Rebuild — original pass

### What was removed
- The entire previous `apps/web/src` tree (mock-data prototype: `mockLabData.ts`, `LabContext` with hardcoded fixtures, 10 disconnected views, dark indigo "AI dashboard" styling) was deleted outright at the user's explicit instruction.
- The previous frontend **never called the API** — it rendered static fixtures in a dark purple/indigo theme that had already been rejected.

### What was built
A production-shaped frontend built directly against the live Express API (`/api/v1`), in a restrained operational style: navy sidebar, light workspace, teal accent, dense readable tables.

**Architecture**
- `src/lib/api.ts` — typed API client: `credentials: 'same-origin'`, in-memory CSRF token sent as `x-csrf-token`, structured `ApiError`, `newCommandId()` for idempotent write operations.
- `src/context/AuthContext.tsx` — session restore via `GET /auth/me` on mount; login/logout; role flags.
- `src/context/LabContext.tsx` — single source of truth for items, categories, locations, kits, requests, allocations, projects, users and dashboard metrics. **Reloads automatically when the signed-in identity changes.**
- `src/context/CartContext.tsx` — multi-item request cart.
- `src/components/common/ui.tsx` — design primitives (Badge, Modal, Drawer, Callout, KpiCard, StockBar, Empty/Loading/Error states) plus status-tone helpers shared across every screen.

**Screens (13)**
| Admin | Student |
|---|---|
| Dashboard (KPIs, low stock, activity) | Dashboard (personal KPIs, own requests, loans) |
| Inventory (grid + table, filters, detail drawer) | Browse Inventory (same catalogue, cart actions) |
| Request Queue (queue + partial-approval modal) | My Requests (status timeline) |
| Issue Desk (counter handover, serialized unit picker) | My Borrowed Items |
| Returns Desk (3-tier condition grading) | Kits & Bundles (1-click add BOM to cart) |
| Stock Intake (item/location/asset-code receipt) | Lab Layout (room → cabinet → drawer explorer) |
| Kits & Bundles, Lab Layout, Audit Ledger (CSV export), Users & Projects | Request Cart |

### Verified end-to-end in a real browser (Chromium via CDP)
1. **Login** as admin and as student; session survives reload via HttpOnly cookie.
2. **Request → Approve**: Priya Nair's request approved in the UI; DB confirmed `APPROVED` with approved quantities, others untouched.
3. **Issue**: handed over Arduino (unit `ARD-003` chosen from live picker) + 2 servos. DB confirmed stock 6→5 and 18→16, `ARD-003 → ALLOCATED`, allocation created, 2 `ISSUE` movements logged.
4. **Return**: Arduino checked in as *Needs checking* → `ARD-003 → UNAVAILABLE` (not restocked); servos returned *Working* → 16→18. Both logged with exact condition. **Condition logic proven correct.**
5. **Student request**: submitted from cart, persisted as `PENDING`, appeared in My Requests.
6. **Stock intake**: bulk receipt of 10 jumpers → 48→58 with a `RECEIPT` movement logged.
7. **Role separation**: student sees no admin navigation; admin-only routes redirect.

### Verification results
- `tsc --noEmit` — clean (0 errors) for both `apps/web` and `apps/api`.
- `vite build` — succeeds; 1924 modules; 395 kB JS (113 kB gzip), 24 kB CSS.
- API test suite — **10/10 pass** (`auth`, `management`, `workflows`). Required raising `hookTimeout` to 60s: the DB-reset hook exceeded the 10s default on this machine.
- Live API smoke: 36 items, 6 kits, 73 serialized units, 30 locations, 7 categories, 3 projects.

### Backend fix (blocking bug)
`apps/api/src/server.ts` never loaded environment variables, so `DATABASE_URL` was undefined at runtime and every DB call failed with *"Environment variable not found: DATABASE_URL"*. The API only ever worked because `start.bat` exported the variable into the shell. Fixed by adding `import 'dotenv/config'` as the first import, and `start.bat` no longer needs to set it.

### Seed data
`apps/api/prisma/seed.ts` expanded from 4 items to a full demo dataset: **7 categories, 36 authentic components, 73 serialized units, 30 locations across 4 rooms, 6 kits, 3 projects, 6 users, 3 pending requests.** All credentials use password `Password@123`.

### Not done in this pass
- Backend was intentionally left functionally unchanged (user's instruction: frontend first).
- PostgreSQL runtime, concurrency tests and backup/restore drill remain unverified (no Docker/PostgreSQL on this machine).

---

## 1. Project Origin

This project started as an initiative for the college's Deep-Tech Innovation Centre. The centre has a lab on the fifth floor, with multiple rooms, where students will work on robotics, electronics, IoT, embedded systems, automation, and other deep-tech projects.

The lab and its projects are currently in the starting phase. The first version must therefore be simple, practical, and easy for lab staff and students to use. It must not become a heavy institutional asset-management, procurement, finance, medicine, or compliance system.

The system will be developed using Node.js. The detailed framework, database, frontend, and final architecture have not yet been approved and must be discussed before implementation.

## 2. Core Goal

Build a lab inventory system where:

- Students can browse available inventory.
- Students can request items for themselves or a project/team.
- Admin can approve, partially approve, or reject requests.
- Admin can issue approved items.
- Returnable items can be marked as returned.
- Consumable stock is reduced when issued.
- Admin can add newly received stock through a simple dashboard workflow.
- Inventory locations can be tracked across rooms, cabinets, racks, and optional shelves/drawers.
- The system keeps complete transaction and allocation history.
- The design remains expandable as the Innovation Centre grows.

## 3. Product Principles

1. **Keep Version 1 simple:** Do not add complex workflows without a real lab requirement.
2. **Admin controls inventory:** Only admins can add, edit, remove, issue, return, or correct stock.
3. **Students get controlled access:** Students can view inventory, request items, and see their current and past allocations.
4. **Support both students and teams:** Items may be allocated to an individual student or a project/team.
5. **No strict return enforcement:** An expected return date is optional. The important action is whether the item was returned.
6. **Condition is optional:** Condition must never be a mandatory issue/return field.
7. **Avoid unnecessary institutional modules:** No grant, budget, vendor, warranty, accounting, or detailed procurement system in Version 1.
8. **Prepare for growth:** The current scope is one fifth-floor lab with multiple rooms, but the data structure should not block future expansion.

## 4. User Roles

### 4.1 Student

Students should have their own dashboard. They can:

- Log in.
- Browse and search inventory.
- See items they are permitted to view.
- See availability or exact quantities, subject to final confirmation.
- View basic details and storage location.
- Request items for themselves.
- Request items for a project/team.
- Add a short purpose to a request.
- View request status: Pending, Approved, Partially Approved, or Rejected.
- View items currently allocated to them or their team.
- View their previous requests, issues, and returns.

Students cannot directly modify stock or mark items as issued/returned.

### 4.2 Admin

Admin can:

- Add, edit, and remove inventory records.
- Add received stock.
- Create and manage categories.
- Review requests.
- Approve, partially approve, or reject requests.
- Issue approved items.
- Mark returnable items as returned.
- Create and manage packages/kits.
- Set and update locations.
- View allocations, history, and low-stock warnings.
- Manage student and project/team records.

For Version 1, only admin performs inventory-changing actions.

## 5. Inventory Model

### 5.1 Item Nature

Every item is one of these:

#### Returnable

Expected to come back to the lab, for example:

- Arduino boards
- Raspberry Pi boards
- Multimeters
- Tools
- Robotics controllers
- Selected motors and sensors

Record:

- Recipient student and/or project
- Issue date
- Optional expected return date
- Returned status
- Actual return date when returned
- Optional condition and note

There is no mandatory overdue, review, penalty, or escalation workflow.

#### Consumable

Not expected to return, for example:

- Solder wire
- Screws
- Connectors
- Small components
- Certain wires

Available quantity decreases when the item is issued.

### 5.2 Tracking Method

The system supports both:

#### Individually Tracked Items

Important equipment can have one record per physical unit:

- Unique unit ID
- Optional manufacturer serial number
- Optional QR code/barcode in a later or confirmed scope
- Model
- Status
- Location

Example: `ARD-001`, `ARD-002`.

#### Quantity-Tracked Items

Cheap or bulk items are tracked by quantity rather than individual IDs:

- Total quantity
- Available quantity
- Allocated/consumed quantity
- Optional minimum stock level

The exact categories requiring unique IDs are still to be confirmed.

## 6. Request, Approval, and Issue Workflow

1. Student browses inventory.
2. Student selects items or a predefined package.
3. Student selects Personal or Project/Team request.
4. Student enters quantities and a short purpose.
5. Request is submitted as Pending.
6. Admin reviews availability.
7. Admin approves, partially approves, or rejects it.
8. Approval and physical issue remain separate actions.
9. When physically handed over, admin marks the final quantities/units as Issued/Allocated.
10. For consumables, available stock decreases.
11. For returnables, the unit/quantity becomes allocated.
12. On return, admin marks it Returned and the inventory becomes available again.

This separation prevents approved-but-not-collected items from being incorrectly treated as issued.

## 7. Project and Team Support

Items can be allocated to:

- An individual student
- A project/team

A project/team may contain:

- Project name
- Short description
- Team leader
- Team members
- Optional faculty mentor if later confirmed

Even for a team allocation, the system should record which student physically collected the item.

It is not yet decided whether students can create teams or only admins can create/manage them.

## 8. Item Statuses

Keep statuses minimal.

### Individually Tracked Items

- Available
- Reserved, if the reservation workflow is confirmed
- Allocated
- Unavailable

`Unavailable` can cover an item that should not currently be issued, without requiring a full maintenance module.

### Quantity-Tracked Items

Mainly track:

- Total quantity
- Available quantity

Avoid unnecessary status complexity in Version 1.

## 9. Optional Item Condition

Condition is not mandatory. If used, keep it simple:

- Working
- Needs checking
- Not working

An optional note may be added. This is only for operational visibility, not automatic student blame, penalties, or a detailed maintenance workflow.

## 10. Simple Stock Receiving

There is no detailed procurement module.

Admin workflow:

1. Open the dashboard.
2. Select an existing item or create a new item.
3. Enter received quantity.
4. Select its location.
5. Add an optional note.
6. Save.

Record only:

- Item
- Quantity received
- Date
- Admin who added it
- Location
- Optional note

Do not add mandatory vendor, invoice, warranty, grant, budget, funding source, cost, or expiration fields.

## 11. Packages / Kits

Admin can create reusable packages containing multiple inventory items.

Example: Basic Robotics Kit

- 1 Arduino Uno
- 1 motor driver
- 2 DC motors
- 2 wheels
- 1 battery holder
- 1 ultrasonic sensor
- Jumper wires

A package is a saved collection, not independent stock. Issuing a package changes the stock of the real items inside it.

Admin should be able to modify or partially approve package contents if an item is unavailable. Exact package behavior still needs final confirmation.

## 12. Location Tracking

The current scope is the fifth-floor lab, which contains multiple rooms.

Suggested hierarchy:

- Lab
- Room
- Cabinet or rack
- Optional shelf or drawer

Example:

`Fifth-floor Lab → Robotics Room → Cabinet A → Drawer 2`

The current implementation should focus on this lab but avoid a structure that makes future multi-lab support impossible.

## 13. Low-Stock Warnings

Admin can optionally define a minimum stock level for quantity-tracked items.

When available stock reaches or falls below that value, show a simple dashboard warning. No email, WhatsApp, or complex alert system is required initially.

## 14. History and Basic Reports

Maintain history for:

- Stock received
- Requests submitted
- Requests approved, partially approved, or rejected
- Items issued
- Items returned
- Consumables used
- Manual stock corrections

Admin should be able to answer:

- What is available now?
- What is allocated now?
- Which student has which item?
- Which project/team has which item?
- What stock was recently received?
- Which consumables are low?
- Where is an item stored?
- What is the history of an item?

## 15. Proposed Version 1 Scope

### Essential

1. Admin and student login
2. Role-based dashboards
3. Inventory categories
4. Returnable and consumable items
5. Individual-unit and quantity tracking
6. Student inventory browse/search
7. Personal and project/team requests
8. Admin approval, partial approval, and rejection
9. Separate physical issue/allocation action
10. Simple return marking
11. Optional expected return date
12. Simple stock receiving
13. Multi-room location tracking
14. Packages/kits
15. Optional low-stock dashboard warnings
16. Transaction history
17. Current allocation view

### Useful If Sir Confirms

1. QR code or barcode generation/scanning
2. Unique IDs for selected equipment categories
3. Faculty mentor field
4. Reservation immediately after approval
5. Optional condition recording
6. Admin-created accounts versus student self-registration
7. Student-created versus admin-created teams
8. Partial package handling rules
9. CSV/Excel import and export
10. Whether exact available quantity is visible to students

### Later, Not Required Now

1. Multiple separate lab support
2. Email/WhatsApp notifications
3. Detailed maintenance management
4. Vendor and purchase management
5. Warranty management
6. Funding/grant tracking
7. Cost/accounting system
8. Advanced analytics
9. Mobile application
10. College ERP/student-ID integration

## 16. Confirmed Decisions

- The centre is a starting-stage college Deep-Tech Innovation Centre.
- The lab is on the fifth floor and has multiple rooms.
- Students need their own dashboard.
- Students can view inventory, request items, and view their allocations.
- Both individual and project/team allocation are required.
- Admin approval is required.
- Only admins change inventory.
- There is no fixed mandatory return date.
- Expected return date is optional.
- The main return action is simply Returned/Not Returned.
- No separate Needs Review workflow is required.
- Item condition is optional, not mandatory.
- Stock receiving should be simple.
- Packages/kits are useful.
- Location tracking is required.
- Transaction/history reporting is useful.
- Detailed procurement, warranty, funding, and maintenance modules are out of scope for now.
- Sir has approved the proposed project direction.
- The user may build both the backend and frontend with AI assistance.
- Sir has assigned a frontend-skilled teammate to work alongside the user for discussion, guidance, review, and collaboration—not necessarily to take exclusive ownership of the frontend.
- The user should retain end-to-end understanding and ownership while using the teammate's frontend experience to challenge decisions and improve quality.

## 17. Open Questions for Sir

1. Which equipment categories need unique unit IDs?
2. Are QR/barcode labels needed now or later?
3. Will admin create student accounts, or can students register themselves?
4. Can students create teams/projects, or only admin?
5. Should approved items become reserved before physical collection?
6. Is a faculty mentor required for projects?
7. Is Excel/CSV import needed for initial stock?
8. Should students see exact quantities or only availability?
9. What final Node.js framework, database, and frontend should be used?

## 18. Current Technical Status

- The production rebuild is in progress under the user’s explicit Build Mode authorization.
- The user remains the primary full-stack builder; the assigned frontend teammate remains a bounded junior contributor.
- The implemented stack is a strict TypeScript npm-workspace modular monolith: React/Vite frontend, Express 5 API, Prisma, SQLite for isolated local tests, and a separate PostgreSQL production schema/migration.
- Authentication now uses opaque random `HttpOnly` session cookies backed by hashed database session records, expiry/revocation, role authorization, login rate limiting, and CSRF validation on state-changing requests.
- Request decisions, physical issue, return, stock receiving, corrections, users, projects, and project membership are server validated; stock-changing workflows use Prisma transactions and movement/audit records.
- The generated single-page dark dashboard has been replaced by role-focused student/admin navigation and an operational navy/light visual system. Admin work is queue/table-led; student work is catalogue/request-led.
- Verified locally on 2026-09-22: root lint and type-check pass; 10 API tests, 2 frontend component tests, and 3 Chromium Playwright shell/responsive tests pass; API and frontend production builds pass; production dependency audit reports zero vulnerabilities; PostgreSQL Prisma schema validates. A diff whitespace check and targeted secret/dangerous-code scan also pass.
- A root `start.bat` now performs first-run dependency/database setup, starts API and web processes, waits for both health checks, opens the browser, and safely detects an already-running application. It was exercised successfully from Windows CMD.
- Live local wiring was verified against the seeded SQLite development database: API liveness/readiness and web root returned HTTP 200; an admin login → authenticated inventory read (4 items) → CSRF-protected logout smoke flow returned 200/200/200.
- PostgreSQL migration SQL, GitHub Actions CI, container files, and backup/restore scripts are present.
- Still unverified because this machine has no Docker/PostgreSQL runtime: applying the migration against a live PostgreSQL instance, PostgreSQL concurrency tests, and a real backup/restore drill.
- Full real-backend Playwright request → approval → issue → return coverage and a broader accessibility audit remain pending; current browser tests cover signed-out, admin navigation/intake, and mobile overflow behavior.
- The complete implementation plan remains `.hermes/plans/2026-09-21_114950-deep-tech-lab-inventory-implementation.md`.

## 19. Collaboration and Ownership Plan

### User — End-to-End Builder and Primary Owner

- Build and understand both frontend and backend with AI assistance.
- Finalize business rules with Sir and the frontend-skilled teammate.
- Design the database and API contract.
- Implement authentication, authorization, inventory workflows, and UI integration.
- Keep the complete application understandable and maintainable rather than accepting AI-generated code blindly.
- Test stock, request, approval, issue, return, and history workflows end to end.

### Frontend Teammate — Junior Contributor With Bounded Ownership

The first discussion showed that the teammate has not yet worked on a comparable complete project and currently appears inexperienced and low-initiative. This is an early observation, not a permanent judgment of ability. Do not give him architecture ownership or make the project depend on an open-ended research task.

His useful initial role is:

- Review a small number of relevant existing inventory systems using a structured comparison template.
- Complete one small, clearly defined frontend task with a deadline and acceptance criteria.
- Suggest UI improvements through issues/comments or a separate Git branch.
- Modify agreed frontend components only through reviewed pull requests.
- Learn the project's conventions and increase ownership only after delivering reliable work.

The user remains responsible for the product direction and end-to-end implementation. The teammate should receive real bounded ownership—not unrestricted direct access and not meaningless "make any improvements" work.

### Shared Working Rules

- Agree on ownership after meeting; do not assume either exclusive frontend ownership or an undefined "both will do everything" arrangement.
- Keep one person accountable for each task to avoid duplicate work.
- Agree on screen list, field names, status names, and request/response shapes before parallel development.
- Use one shared repository, API contract, task board, and coding conventions unless the teammate presents a stronger practical alternative.
- Review pull requests instead of both people editing the same files without coordination.
- Test each completed end-to-end workflow together.
- Escalate requirement decisions to Sir only when they affect scope or lab policy; technical implementation details should normally be settled within the team.

## 20. User–Agent Working Agreement

- Project.md must be updated in detail after every project-related user message.
- The agent must think independently and challenge irrelevant, over-engineered, contradictory, risky, or impractical ideas instead of simply agreeing.
- **Learning mode:** when the user asks how or why something happened, explain it for a beginner with reasoning and practical examples.
- **Build mode:** when the user directly asks to build, implement first, then test and verify; do not force a long lesson unless needed for a decision or safety.

## 21. Agenda for First Meeting With Frontend-Skilled Teammate

1. **Background and approved scope:** Explain the Deep-Tech lab, user roles, inventory types, request/approval/issue/return flow, locations, kits, and intentionally excluded complex modules.
2. **Clarify roles:** State that Sir allowed the user to build the complete application with AI assistance and asked the teammate to collaborate because of frontend experience. Agree who owns which deliverable.
3. **Understand teammate's experience:** Ask what frameworks, state-management tools, form libraries, styling systems, testing tools, and Git workflows they have actually used.
4. **Choose frontend approach:** Compare the user's and teammate's preferred stack based on project needs and familiarity; do not select tools merely because they are popular.
5. **Review screen list and workflows:** Walk through student and admin journeys before discussing colors or visual polish.
6. **Define frontend/backend boundary:** Backend owns permissions, stock calculations, status transitions, validation, and audit records. Frontend renders state, gathers input, and calls APIs.
7. **Agree on API collaboration:** Decide OpenAPI/Swagger or another shared contract, sample responses, error shape, authentication handling, and how breaking changes are communicated.
8. **Agree on repository workflow:** Branch naming, pull requests, reviews, ownership per task, conflict avoidance, and issue tracking.
9. **Agree on first milestone:** Prefer one thin end-to-end workflow—login, inventory list, request submission, and admin request view—before building every dashboard screen.
10. **Record open disagreements:** Do not force decisions in the meeting; bring scope/policy questions to Sir and test technical uncertainties with a small prototype.

## 22. Immediate Collaboration Decision

- Do not pause development while waiting for the teammate's broad inventory-system research.
- The user should proceed as primary full-stack builder after the remaining architecture decisions are discussed and locked.
- Do not grant direct write access to the main branch. Use a separate branch and reviewed pull requests.
- Replace the vague research assignment with a structured comparison of 3 relevant systems: screenshots/links, useful workflows, irrelevant enterprise features, and recommendations for this lab.
- Give the teammate one small trial task after the frontend foundation exists, such as a reusable empty/loading/error state, responsive inventory table, or one low-risk screen.
- Evaluate the trial on delivery, communication, code quality, responsiveness, and ability to explain the code.
- Increase responsibility only after demonstrated delivery; otherwise keep him as an occasional contributor without blocking the project.

## 23. Proposed Implementation Baseline

The complete researched plan is stored at:

`.hermes/plans/2026-09-21_114950-deep-tech-lab-inventory-implementation.md`

Its proposed phase order is:

1. Lock product policies, vocabulary, and state transitions.
2. Produce user journeys, wireframes, and the OpenAPI contract skeleton.
3. Set up the TypeScript monorepo, PostgreSQL development environment, tests, and CI.
4. Implement schema, constraints, migrations, and deterministic seed data.
5. Implement secure sessions, authentication, CSRF protection, and authorization.
6. Implement categories, locations, catalogue, and student browse flow.
7. Implement stock receiving, serialized units, movements, and corrections.
8. Implement projects, requests, and admin decisions.
9. Implement physical issue, allocation, return, idempotency, and concurrency protection.
10. Implement kits as templates that expand into ordinary request lines.
11. Add dashboards, low-stock views, and history filters.
12. Complete security, accessibility, and reliability hardening.
13. Complete CI/E2E quality gates.
14. Deploy staging, prove backup restoration, run a controlled pilot, and then release production.

Key proposed architectural choices remain subject to the user's review before implementation: Node.js 24 LTS, TypeScript, Express 5, PostgreSQL, Prisma, React/Vite, same-origin server-side sessions, OpenAPI-generated frontend types, and a modular monolith rather than microservices.

## 24. Current Prototype Review and Redesign Direction

### Review status

- The generated application is a prototype, not a finished or production-ready implementation.
- Its broad domain coverage is useful, but the implementation skipped the required discussion, wireframing, design-system, TDD, security-hardening, PostgreSQL, and deployment gates.
- The user rejects the current generic AI-dashboard visual direction. No redesign or implementation should start until the product experience and visual direction are discussed and approved.

### Useful parts to preserve conceptually

- The monorepo split (`apps/api`, `apps/web`, `packages/contracts`).
- Core inventory concepts: catalogue, serialized versus bulk stock, returnable versus consumable items, requests, approval, physical handover, returns, locations, kits, and movement history.
- Backend-authoritative stock changes and role separation.

### Claims that must not be treated as verified completion

- The report claims PostgreSQL and secure server-side sessions, but the prototype currently uses a committed SQLite database and an unsigned user-ID cookie rather than a real session store.
- It claims comprehensive automated verification, but no unit, integration, concurrency, or Playwright test files are present in the repository.
- It claims production hardening despite disabled CSP, hardcoded development CORS, missing rate limiting and CSRF controls, and insufficient state/quantity/concurrency validation in critical stock paths.
- It calls the application 100% complete even though the repository has no deployment/CI/backup implementation and several planned modules are missing or incomplete.

### Redesign principles to discuss

- Design an operational college-lab tool, not a purple-glow SaaS/AI dashboard.
- Use separate student and admin information architecture instead of one oversized tabbed `App.tsx`.
- Prefer dense, readable tables and task queues for admin workflows; use cards only where they improve student browsing.
- Use plain lab language such as Dashboard, Inventory, Requests, Issue Desk, Returns, Locations, and History; avoid decorative language such as Command, Telemetry, Identity Portal, and System Online.
- Establish college/lab branding, typography, spacing, color, responsive behavior, accessibility, and component states before coding.
- Remove demo credentials and demo shortcuts from any production-facing interface.

### Required next gate

1. Audit the backend against the original implementation plan and create a keep/rewrite/fix matrix.
2. Rebuild the application in tested vertical slices; do not attempt a cosmetic reskin over unsafe backend foundations.
3. Verify the final student and admin workflows in a real browser, then complete production hardening and deployment evidence.

The user has explicitly authorized Build Mode and does not want further prototypes or design-approval pauses. Low-stakes product and design decisions should be made autonomously from the approved requirements and research; ask only when an unavailable stakeholder fact creates a genuine implementation blocker.

### Chosen working direction

- Proceed with a modern technical-lab interface: restrained navy navigation, light operational workspace, teal accent, compact borders, and minimal shadows.
- Treat the admin experience primarily as an **Operate** surface: queues, tables, next actions, issue/return desks, and exception visibility.
- Treat the student catalogue primarily as an **Explore** surface: search, filters, availability, request cart, and clear personal status.
- Separate student and admin navigation and avoid a single oversized tabbed page.
- A no-backend-write interactive direction prototype is available at `docs/design-direction-prototype.html`; it includes switchable admin dashboard and student catalogue views.
- The prototype remains only a historical discussion artifact. The user explicitly removed the prototype approval gate and directed implementation of the final product; it is not used by the runtime application.

## 25. Change Log

### 2026-10-10 — E2E Test Suite Rebuilt; Two Product Bugs Found and Fixed

- Replaced the stale `e2e/shell.spec.ts` (targeted the deleted UI; 2 of 3 tests failing) with 32 Playwright tests across four specs, all running against the real Express + Prisma backend with no API mocking.
- Added a dedicated, auto-seeded `e2e.db` plus per-file database reset so specs are order-independent and never touch `dev.db`.
- Fixed a genuine responsive defect: the app overflowed horizontally by 145px on every screen at mobile width. Added a slide-over navigation drawer, a wrapping topbar, and contained table scrolling; verified 0px overflow on all 13 screens at 390×844.
- Fixed an accessibility defect: form labels lacked `htmlFor`/`id` association; added those plus `aria-label`s to icon-only controls.
- Added `npm run test:e2e`, `test:e2e:ui`, `test:e2e:report`, and `e2e/README.md`.

### 2026-10-10 — Frontend Rebuilt From Scratch Against the Live API

- Analysed the whole repository: real Express 5 + Prisma backend, but a frontend that ran entirely on hardcoded mock data and never called the API.
- Warned the user that the existing backup folder (`inventory project - Copy`) held the **old** frontend, not the current one; the user chose to delete the current frontend without preserving it.
- Deleted the complete previous `apps/web/src` tree and rebuilt 13 screens against real endpoints.
- Fixed a blocking backend bug: `apps/api/src/server.ts` never loaded `dotenv`, so `DATABASE_URL` was undefined at runtime.
- Expanded the seed from 4 items to 7 categories / 36 components / 73 serialized units / 30 locations / 6 kits / 3 projects / 6 users / 3 pending requests.
- Verified login, request→approve, issue (with serialized unit selection), return (with condition grading), student submission, and stock intake in a live browser; confirmed each against the database.
- Restyled from the rejected dark purple/indigo AI-dashboard look to a restrained navy + light operational system.
- `tsc` clean, `vite build` green, API tests 10/10.

### 2026-09-22 — Foreground Single-Window Process Lifecycle & Port Cleanup

- Terminated orphaned Vite dev server process (PID 16124) lingering on port 5173 from previous background test runs.
- Verified both port 5173 and port 4000 are completely free of active background listeners.
- Simplified `start.bat` to run `npm run dev` directly in the active terminal window (foreground) instead of detaching into a separate unmanaged window via `start cmd /k`. Closing the terminal window now immediately terminates both API and Web processes cleanly.

### 2026-09-22 — One-Click Local Startup and Live Wiring Verification

- Added `start.bat` at the project root for dependency setup, SQLite schema preparation, first-run seed data, API/web startup, health polling, browser launch, and already-running detection.
- Exercised the batch file from Windows CMD and fixed two environment-specific failures: Prisma DLL locking when servers already existed and Git Bash shadowing Windows `timeout.exe`.
- Verified API liveness/readiness, web HTTP response, admin session login, authenticated inventory retrieval, CSRF-protected logout, and repeat execution of `start.bat`.
- Re-ran lint, type-check, 12 automated unit/component/integration tests, 3 Chromium Playwright tests, production builds, and the production dependency audit successfully.

### 2026-09-22 — Production Rebuild: Security, Workflows, UI, Tests, and Operations

- Replaced forgeable user-ID cookie authentication with opaque hashed database sessions, expiry/revocation, CSRF checks, role checks, and login rate limiting.
- Reworked inventory, request decisions/cancellation, issue, return, stock intake/corrections, user, project, and membership routes with validation and transactional stock/audit behavior.
- Added isolated API integration tests, frontend role-shell tests, and Chromium Playwright shell/responsive tests; verified 10 API tests, 2 frontend component tests, 3 browser tests, type-check, build, and zero production dependency vulnerabilities.
- Replaced the generated dark all-in-one dashboard with distinct operational admin and student navigation, readable queues/tables, searchable catalogue views, responsive layout, and accessible states.
- Added a PostgreSQL production schema, generated initial migration, GitHub Actions quality/migration jobs, container deployment files, and backup/restore runbook/scripts.
- Kept completion claims honest: live PostgreSQL execution, concurrency tests, full real-backend Playwright workflows, and a restore drill remain pending because the local machine currently has no Docker/PostgreSQL runtime.

### 2026-09-22 — Product Direction Prototype

- User authorized autonomous progress after the prototype audit.
- Selected a restrained modern technical-lab direction rather than the rejected purple-glow AI-dashboard style.
- Created an interactive admin/student product-direction prototype without modifying application code or backend behavior.
- Kept implementation on hold pending visual and workflow feedback from the user.

### 2026-09-22 — Generated Prototype Audit and Redesign Hold

- Reviewed `implementation-plan-report.md` against the repository and original implementation plan.
- Reclassified the claimed 100%-complete system as an unverified prototype.
- Recorded visual rejection, report/code contradictions, missing tests and security controls, and the requirement to discuss UX direction before implementation.
- Locked the principle that the next version must be workflow-led and operational rather than a generic AI-generated dashboard.

### 2026-09-21 — Complete Researched Implementation Plan

- Researched comparable lab inventory workflows, stock traceability, hierarchical locations, secure Node/Express architecture, PostgreSQL transaction safety, React data/forms/accessibility patterns, testing, CI, deployment, and backup/restore.
- Produced a complete phase-by-phase implementation plan with scope boundaries, proposed state machines, entity model, API map, security controls, TDD strategy, concurrency tests, teammate contribution rules, deployment runbook, risk register, and final definition of done.
- Kept the plan in proposed status: Phase 0 policy and architecture decisions must be discussed before code is created.

### 2026-09-16 — Teammate Capability Assessment and Bounded Contribution Plan

- The first meeting indicated that the assigned frontend teammate is a beginner without comparable project experience and currently shows low initiative.
- Chose not to make project progress dependent on him or give him architecture ownership.
- The user will proceed as the primary full-stack builder.
- Added a bounded research assignment, a small trial task, branch protection, pull-request review, and evidence-based responsibility growth.

### 2026-09-16 — End-to-End Ownership and Collaboration Model

- Sir confirmed that the user may build the complete application using AI assistance.
- A frontend-skilled teammate will remain involved for discussion and collaboration.
- Reframed the teammate from exclusive frontend owner to collaborator/reviewer, while leaving room for an agreed screen/component split.
- Added the first-meeting agenda and rules to prevent duplicate work, unclear ownership, and frontend business-logic drift.
- Recorded the user's requirement for detailed documentation after every project message, independent critical thinking, Learning mode, and Build mode.

### 2026-09-16 — Approval and Initial Team Plan

- Sir approved the proposed project direction.
- Sir initially confirmed that one frontend developer would be provided.
- This was later clarified: the user may build the full application, while the frontend-skilled teammate collaborates and provides expertise.

### 2026-09-16 — Initial Requirements Capture

- Documented the origin and purpose of the college Deep-Tech Innovation Centre inventory system.
- Defined admin and student roles.
- Added individual and project/team requests.
- Added returnable and consumable inventory behavior.
- Added individual-unit and quantity tracking.
- Kept condition and expected return date optional.
- Removed strict overdue/review and complex procurement concepts.
- Added simple stock receiving, packages/kits, multi-room locations, low-stock warnings, and transaction history.
- Recorded confirmed decisions and questions still requiring Sir's answer.
