# Deep-Tech Lab Inventory Management System — Complete Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build and deploy a secure, maintainable lab inventory web application for the college Deep-Tech Innovation Centre, covering inventory receiving, discovery, requests, approval, physical issue, return, current allocation, locations, kits, low-stock visibility, and immutable operational history.

**Architecture:** Use a TypeScript modular monolith in one npm-workspaces repository: a React/Vite browser application, an Express REST API, and PostgreSQL as the system of record. Keep frontend and API on one origin in production, keep all stock rules and permission checks on the server, and use database transactions plus constraints to prevent double issue and negative stock.

**Tech Stack:** Node.js 24 LTS, TypeScript (strict), npm workspaces, Express 5, PostgreSQL, Prisma ORM/Migrate, React with TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, OpenAPI 3.1, Vitest, React Testing Library, Supertest, Playwright, Docker Compose, GitHub Actions.[18]

**Plan status:** Proposed implementation baseline for review. It is detailed enough to execute, but the Phase 0 policy decisions must be confirmed before schema/API implementation.

**Research date:** 2026-09-21

---

## 1. Executive Recommendation

Build this as a **single, modular full-stack application**, not microservices. The expected users, inventory size, and team size do not justify distributed services, Redis, queues, Kubernetes, event sourcing, or a separate analytics platform.

Use these boundaries:

```text
Browser
  └─ same HTTPS origin
      ├─ /                 React static application
      └─ /api/v1/*         Express API
                              └─ PostgreSQL
```

Use one repository, one API, one database, and one deployment unit. Separate the code by business module so it can grow without being prematurely distributed.

Existing inventory systems validate the important domain split: a catalogue item is different from its physical stock instances, and selected units may have serial identifiers.[1]

Locations can be hierarchical, and every stock adjustment should leave history.[1][2]

University lab workflows also centre on four immediate questions: what exists, where it belongs, who currently has it, and whether it has returned.[3][4]

### The five decisions that matter most

1. **The user remains primary end-to-end builder.** The assigned teammate receives bounded frontend tasks through reviewed pull requests.
2. **Stock changes at physical issue, not approval.** Approval does not reserve inventory in V1. Availability is checked during approval and checked atomically again during issue.
3. **Tracking mode is configured per item.** Expensive reusable equipment is serialized; inexpensive/bulk material is quantity-tracked.
4. **Use server-side browser sessions, not JWTs stored in the browser.** The application is browser-only and same-origin, so revocable opaque sessions are simpler and safer.
5. **Build one working vertical flow before expanding.** Login → browse one item → request → approve → issue → return must work end to end before every secondary screen is built.

---

## 2. Scope Boundary

### 2.1 Version 1 must include

- Admin and student accounts
- Role-based dashboards and server-side authorization
- Categories and hierarchical locations
- Returnable and consumable item definitions
- Serialized and quantity-based tracking
- Simple stock receiving
- Student browse, search, filter, and item details
- Personal and project/team requests
- Approve, partially approve, reject, and cancel rules
- Physical issue as a separate action from approval
- Partial physical issue when approved quantities are collected in stages
- Simple return, including partial return
- Optional expected return date
- Optional return condition/note
- Current allocations/outstanding items
- Kits/packages as reusable request templates
- Low-stock dashboard warnings
- Complete stock movement and business-action history
- Responsive, accessible admin and student web interface
- Automated tests, CI, staging, production deployment, backups, and restore verification

### 2.2 Explicit Version 1 non-goals

Do **not** add these unless Sir changes the approved scope:

- Procurement approval chains
- Vendors, invoices, purchase orders, costs, grants, or budgets
- Warranty and calibration scheduling
- Penalties, fines, or disciplinary overdue workflows
- Email, SMS, or WhatsApp notifications
- Mobile application
- College ERP/SSO integration
- Multi-tenant architecture
- Multiple independent lab administration
- Advanced analytics or forecasting
- Real-time WebSockets
- Offline-first synchronization
- Microservices, Redis, message queues, or Kubernetes
- QR/barcode scanning before the base workflow is stable

### 2.3 Features deliberately postponed to V1.1

- QR label generation and phone-camera scanning
- Initial stock CSV import/export, unless the lab already has a spreadsheet
- Lost-item resolution workflow
- Detailed maintenance/repair records
- Multiple labs
- Student self-registration
- Student-created projects without admin approval
- Reservation with expiry
- Notifications

---

## 3. Phase 0 Decision Gate — Lock Policy Before Code

**Estimated effort:** 2–3 focused working days, mostly discussion and documentation.

**Objective:** Remove ambiguities that would otherwise force schema rewrites or inconsistent frontend behavior.

**Files:**

- Create: `docs/product-decisions.md`
- Create: `docs/domain-glossary.md`
- Create: `docs/workflows.md`
- Create: `docs/status-transitions.md`
- Create: `docs/acceptance-criteria.md`
- Update: `Project.md`

### 3.1 Recommended defaults to take to Sir

| Decision | Recommended V1 answer | Why |
|---|---|---|
| Who creates student accounts? | Admin | Avoid public signup and fake accounts during pilot |
| Student identity | College/student ID + name; email optional if not reliably available | Store only data the workflow needs |
| Who creates projects? | Admin initially; student can request against projects where they are a member | Keeps team records trustworthy |
| Do students see exact stock? | Yes, for authenticated users | Reduces impossible requests; no clear sensitivity exists |
| When does stock change? | Physical issue and return only | Avoid stale approved requests locking stock |
| Does approval reserve stock? | No in V1 | Reservation expiry/release adds complexity not yet justified |
| Unique physical IDs | Per item, controlled by tracking mode | Arduino/Raspberry Pi can be serialized; screws cannot |
| Serialized consumables | Not supported in V1 | No confirmed use case; avoid a needless state branch |
| Quantities | Whole numbers in V1 | Current known items are issued as pieces/packs; add decimal units only if the lab confirms a real need |
| Kit behavior | Expand kit into ordinary request lines at submission | Keeps issue/return logic identical to normal items |
| Expected return | Optional | Matches Sir’s stated workflow |
| Damage condition | Optional; a returned serialized unit may become Unavailable | Operationally useful without blame/penalty workflow |
| QR/barcode | Schema-ready, UI later | Do not delay core workflow for scanning |
| Hosting | Single Linux server/VM or managed container platform, final target confirmed before Phase 11 | Avoid designing around an unknown environment |

### 3.2 Questions that genuinely require confirmation

1. What unique student identifier is available and reliable?
2. Does an admin create every student account?
3. Should students see exact available quantity?
4. Does the lab want whole-unit quantities only?
5. Who may create/archive projects and manage membership?
6. Does the lab already have an inventory spreadsheet requiring import?
7. What infrastructure will host production: college server, cloud VM, or managed platform?
8. Will the application be internet-accessible or restricted to the college/lab network?
9. Who is the named operational owner after deployment?

### 3.3 Canonical vocabulary to lock

- **Item:** Reusable catalogue definition such as “Arduino Uno R3”.
- **Unit:** One serialized physical copy such as `ARD-001`.
- **Bulk stock:** Quantity of an item at one location.
- **Request:** Student’s requested items and purpose.
- **Decision:** Admin approval, partial approval, or rejection.
- **Issue:** Physical handover; the only point where stock leaves availability.
- **Return:** Physical receipt back into the lab.
- **Allocation:** Outstanding returnable quantity/unit currently held by a student/project.
- **Kit:** Reusable template that expands into normal request lines; it owns no stock.
- **Stock movement:** Immutable record of receive, issue, return, move, or correction.
- **Audit event:** Immutable record of a security or business action and its actor.

### 3.4 Canonical statuses

Do not use a generic `status` concept across unrelated entities.

**User status**

```text
ACTIVE | INACTIVE
```

**Project status**

```text
ACTIVE | ARCHIVED
```

**Request decision status**

```text
PENDING
  ├─ APPROVED
  ├─ PARTIALLY_APPROVED
  ├─ REJECTED
  └─ CANCELLED
```

**Request fulfilment status (derived, not manually edited)**

```text
NOT_ISSUED | PARTIALLY_ISSUED | FULFILLED
```

**Serialized unit status**

```text
AVAILABLE → ALLOCATED → AVAILABLE
AVAILABLE → UNAVAILABLE → AVAILABLE
AVAILABLE/UNAVAILABLE → RETIRED
ALLOCATED → UNAVAILABLE   (only through a return marked unusable)
```

There is no `RESERVED` state in V1.

### 3.5 Phase 0 exit gate

- Every listed policy has either a confirmed answer or a documented default accepted by Sir.
- Status names have one meaning each.
- The business glossary is approved.
- No code begins while unit traceability, stock-change timing, or user provisioning is ambiguous.

---

## 4. Phase 1 — User Journeys, Wireframes, and API Contract Skeleton

**Estimated effort:** 1–2 focused working days.

**Objective:** Agree on what users do before designing visual polish or database implementation.

**Files:**

- Create: `docs/screens.md`
- Create: `docs/wireframes/student-flow.md`
- Create: `docs/wireframes/admin-flow.md`
- Create: `packages/contracts/openapi.yaml`
- Create: `packages/contracts/README.md`
- Update: `Project.md`

OpenAPI gives humans, documentation tools, clients, and tests one language-independent interface definition, reducing frontend/backend guesswork.[25] Use OpenAPI **3.1**, not 3.2 initially, because the chosen TypeScript generator currently advertises support for OpenAPI 3.0/3.1.[35]

### 4.1 Screen map

**Shared**

- `/login`
- `/change-password`
- `/forbidden`
- `/not-found`

**Student**

- `/student/dashboard`
- `/student/inventory`
- `/student/inventory/:itemId`
- `/student/requests/new`
- `/student/requests`
- `/student/requests/:requestId`
- `/student/allocations`
- `/student/projects/:projectId`

**Admin**

- `/admin/dashboard`
- `/admin/inventory`
- `/admin/inventory/new`
- `/admin/inventory/:itemId`
- `/admin/inventory/:itemId/edit`
- `/admin/stock/receive`
- `/admin/requests`
- `/admin/requests/:requestId`
- `/admin/issues/new`
- `/admin/allocations`
- `/admin/returns/new`
- `/admin/categories`
- `/admin/locations`
- `/admin/kits`
- `/admin/projects`
- `/admin/users`
- `/admin/history`

### 4.2 First thin vertical milestone

Wireframe and contract only these first:

1. Login
2. Student inventory list
3. Student request form
4. Admin pending-request list/detail
5. Admin decision action
6. Admin physical issue action
7. Student current allocation
8. Admin return action

Do not design every dashboard card first. One complete workflow finds wrong assumptions faster than many disconnected screens.

### 4.3 API conventions

- Base path: `/api/v1`
- JSON only, UTF-8
- Resource names plural and stable
- All dates/times ISO 8601 UTC; UI formats them for IST
- Pagination: `page`, `pageSize` with a server maximum of 100
- Search: normalized `q` plus explicit filters
- Success collections: `{ "data": [...], "meta": { "page", "pageSize", "total" } }`
- Errors: `{ "error": { "code", "message", "fieldErrors", "requestId" } }`
- Use action endpoints for controlled transitions; do not expose arbitrary status edits
- Return `409 Conflict` for stale state, insufficient stock, duplicate commands, or invalid transitions
- State-changing issue/return/receive commands carry a client-generated UUID so retries cannot duplicate the operation

### 4.4 Initial endpoint map

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me
POST   /auth/change-password
GET    /auth/csrf

GET    /items
GET    /items/:id
POST   /items                         admin
PATCH  /items/:id                     admin
POST   /items/:id/archive             admin
GET    /items/:id/units               admin
POST   /items/:id/units               admin

GET    /categories
POST   /categories                    admin
PATCH  /categories/:id                admin

GET    /locations
POST   /locations                     admin
PATCH  /locations/:id                 admin

POST   /stock-receipts                admin
POST   /stock-adjustments             admin
POST   /stock-moves                   admin

GET    /projects
POST   /projects                      admin in V1
PATCH  /projects/:id                  admin
POST   /projects/:id/members          admin
DELETE /projects/:id/members/:userId  admin

GET    /kits
POST   /kits                          admin
PATCH  /kits/:id                      admin
POST   /kits/:id/archive              admin

POST   /requests                      student
GET    /requests                      role-scoped
GET    /requests/:id                  owner/member or admin
POST   /requests/:id/cancel           allowed transition only
POST   /requests/:id/decision         admin

POST   /issues                        admin
GET    /allocations                   role-scoped
POST   /returns                       admin

GET    /history                       admin
GET    /dashboard/student             student
GET    /dashboard/admin               admin

GET    /health/live
GET    /health/ready
```

### 4.5 Frontend teammate’s bounded research deliverable

Ask for exactly three relevant systems. For each, require:

- Link and screenshots
- Inventory browsing/search behavior
- Request/approval behavior
- Stock receiving/issue/return behavior
- Mobile behavior
- Useful ideas for this project
- Irrelevant enterprise features to reject
- One concrete recommendation

Do not wait for this deliverable to begin Phase 2. Use it as design input, not a blocker.

### 4.6 Phase 1 exit gate

- Every V1 user action maps to a screen and endpoint.
- Initial OpenAPI file validates.
- Frontend and backend use the same field and status names.
- Wireframes cover loading, empty, validation-error, forbidden, and success states.

---

## 5. Phase 2 — Repository and Engineering Foundation

**Estimated effort:** 3–4 focused working days.

**Objective:** Create a repeatable local environment and quality gates before feature code.

Node production applications should use an Active or Maintenance LTS release; Node 24 is LTS at the time of this plan.[5]

### 5.1 Planned repository structure

```text
inventory-project/
├─ .github/
│  └─ workflows/
│     └─ ci.yml
├─ .hermes/plans/
├─ apps/
│  ├─ api/
│  │  ├─ prisma/
│  │  │  ├─ migrations/
│  │  │  ├─ schema.prisma
│  │  │  └─ seed.ts
│  │  ├─ src/
│  │  │  ├─ app.ts
│  │  │  ├─ server.ts
│  │  │  ├─ config/env.ts
│  │  │  ├─ db/prisma.ts
│  │  │  ├─ middleware/
│  │  │  ├─ modules/
│  │  │  └─ shared/
│  │  └─ tests/
│  │     ├─ integration/
│  │     └─ helpers/
│  └─ web/
│     ├─ src/
│     │  ├─ app/
│     │  ├─ api/
│     │  ├─ components/
│     │  ├─ features/
│     │  ├─ pages/
│     │  ├─ styles/
│     │  └─ test/
│     └─ public/
├─ packages/
│  └─ contracts/
│     ├─ openapi.yaml
│     └─ generated/
│        └─ api.d.ts
├─ tests/
│  └─ e2e/
├─ infra/
│  ├─ compose.yaml
│  ├─ compose.production.yaml
│  └─ proxy/
├─ scripts/
│  ├─ backup-db.sh
│  ├─ restore-db.sh
│  └─ verify-backup.sh
├─ docs/
│  ├─ decisions/
│  ├─ runbooks/
│  └─ testing/
├─ .editorconfig
├─ .env.example
├─ .gitignore
├─ .nvmrc
├─ eslint.config.js
├─ package.json
├─ package-lock.json
├─ tsconfig.base.json
├─ README.md
└─ Project.md
```

### 5.2 Foundation tasks

1. Initialize Git and protect `main` after the remote is created.
2. Create npm workspaces for `apps/api`, `apps/web`, and `packages/contracts`.
3. Pin Node 24 in `.nvmrc` and `package.json#engines`.
4. Enable TypeScript strict mode and `noUncheckedIndexedAccess`.
5. Add ESLint and Prettier with one root configuration.
6. Add `.env.example`; never commit real credentials.
7. Create local PostgreSQL through `infra/compose.yaml`.
8. Add root scripts for dev, lint, typecheck, test, build, database migration, and E2E.
9. Add pre-commit checks only if they remain quick; CI is the final gate.
10. Add a minimal `/health/live` API and React shell as the first executable proof.

### 5.3 Exact verification commands

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```

Expected result: all checks pass; web shell loads; `/api/v1/health/live` returns 200.

### 5.4 Git rules

- `main` is protected.
- Every change uses `feature/*`, `fix/*`, `docs/*`, or `chore/*` branch.
- Pull request requires passing CI and one review where a reviewer exists.
- Never commit `.env`, dumps, test credentials, or generated secrets.
- Keep commits small and descriptive: `feat(stock): add receiving transaction`.

### 5.5 Phase 2 exit gate

- A fresh clone can install, start PostgreSQL, migrate, run checks, and launch both apps using documented commands.
- CI runs on a clean machine.
- No business feature exists without a test harness.

---

## 6. Phase 3 — Database Schema, Constraints, and Seed Data

**Estimated effort:** 3–4 focused working days.

**Objective:** Establish the data model and invariants before API feature work.

PostgreSQL constraints should reject invalid data even if an application bug reaches the database.[11] Prisma supports atomic transactions and explicit isolation levels; high-contention issue/return operations should use short transactions and retry documented serialization conflicts.[9]

### 6.1 Core entities

```text
users
sessions
projects
project_members
categories
locations
items
inventory_units
stock_balances
stock_receipts
stock_receipt_lines
stock_movements
requests
request_lines
request_status_history
issues
issue_lines
issue_line_units
returns
return_lines
return_line_units
kits
kit_items
audit_events
```

### 6.2 Essential fields and relationships

**`users`**

- `id` UUID
- `college_id` unique
- `name`
- `email` nullable unique
- `role` (`ADMIN`, `STUDENT`)
- `status` (`ACTIVE`, `INACTIVE`)
- `password_hash`
- `must_change_password`
- timestamps

**`projects` / `project_members`**

- Name, description, status
- Leader/member roles
- Unique `(project_id, user_id)` membership
- Archived projects retain history

**`locations`**

- `id`, `name`, `type`, `parent_id`, `is_active`
- Adjacency-list hierarchy
- Sibling uniqueness by normalized name
- No deletion if referenced

**`items`**

- Name, optional model/description
- Category
- `nature`: `RETURNABLE | CONSUMABLE`
- `tracking_mode`: `SERIALIZED | BULK`
- Unit of measure
- Optional low-stock threshold
- Default location
- Active/archived

**`inventory_units`**

- Item relation
- Unique asset code
- Optional manufacturer serial
- Home location and current location
- `AVAILABLE | ALLOCATED | UNAVAILABLE | RETIRED`
- Optional condition note

**`stock_balances`**

- Unique `(item_id, location_id)`
- `available_quantity >= 0`
- `unavailable_quantity >= 0`
- Bulk items only

**`stock_movements`**

- Append-only
- Item/unit, quantity, source/destination location
- Movement type
- Related receipt/issue/return/adjustment
- Actor, reason, timestamp
- Before and after quantity where meaningful

**`requests` / `request_lines`**

- Requester
- Personal or project target
- Purpose
- Decision status
- Requested and approved quantity per line
- Decision notes
- Submission/decision timestamps

**`issues` / `issue_lines` / `issue_line_units`**

- Request relation
- Recipient/project and collector
- Admin issuer
- Optional expected return date
- Approved line relation
- Issued quantity and exact units where serialized
- Unique client command ID

**`returns` / return lines**

- Related issue lines/units
- Returned quantity
- Optional condition/note
- Processed by admin
- Unique client command ID

**`kits` / `kit_items`**

- Kit name and active flag
- Item and quantity lines
- At request creation, kit content is copied to normal request lines

**`audit_events`**

- Actor, action, entity type/id
- Request/correlation ID
- Safe before/after metadata
- Timestamp
- No update/delete API

### 6.3 Database invariants

- Quantities are positive integers in V1.
- `approved_quantity <= requested_quantity`.
- `issued_quantity <= approved remaining quantity`.
- `returned_quantity <= outstanding returnable quantity`.
- Bulk stock never becomes negative.
- One serialized unit cannot have two open allocations.
- A serialized item is returnable in V1.
- A personal request has no project; a project request has one project.
- Project requester must be an active project member.
- Archived/inactive entities cannot enter new transactions.
- Historical records are never hard-deleted.
- All business timestamps are UTC.

### 6.4 Migration workflow

- Development: create reviewed migrations with `prisma migrate dev`.
- Production/test: apply committed migrations with `prisma migrate deploy`; never run development reset commands in production.[10]
- Add custom SQL inside migrations for database checks or partial unique indexes Prisma cannot express cleanly.
- Never edit an already-applied migration.
- Seed deterministic demo users, locations, items, and one project; no real student data.

### 6.5 Tests written before schema-dependent services

- Constraint rejects zero/negative quantities.
- Duplicate college ID fails.
- Duplicate asset code fails.
- Duplicate project membership fails.
- Invalid request target combination fails.
- Stock balance cannot become negative.
- Referenced records cannot be hard-deleted.

### 6.6 Phase 3 exit gate

- Empty database migrates successfully.
- Seed runs twice safely or fails with a clear duplicate guard.
- Schema diagram and field dictionary match the migration.
- Constraint tests pass against real PostgreSQL.

---

## 7. Phase 4 — Authentication, Sessions, and Authorization

**Estimated effort:** 5–7 focused working days.

**Objective:** Establish identity and permissions before inventory-changing endpoints.

For a same-origin browser application, use opaque server-side sessions. `express-session` stores only a session identifier in the cookie, but its built-in MemoryStore is explicitly not suitable for production, so sessions must be persisted in PostgreSQL.[7] Cookies should be `HttpOnly`, `Secure` in production, and `SameSite`; session IDs must be meaningless and server state must hold user/role data.[13] Use Argon2id for new password hashes rather than bcrypt unless compatibility forces otherwise.[14]

### 7.1 Authentication design

- Admin provisions accounts in V1.
- Initial one-time password must be changed at first login.
- Password hash: Argon2id with parameters benchmarked on deployment hardware.
- Session cookie: host-only, `HttpOnly`, `Secure` in production, `SameSite=Lax`, explicit expiry.
- Rotate session ID on successful login and privilege change.
- Delete server session on logout.
- Idle and absolute session limits; proposed starting point: 8-hour absolute session for lab use.
- No JWT in localStorage.
- No public password-reset email workflow in V1; admin issues a new one-time credential through an approved offline channel.
- Inactive accounts cannot authenticate, but their historical records remain.

### 7.2 Authorization model

- Deny by default.
- Validate authorization on every API request, not only in frontend routes.[15][17]
- Admin-only: inventory mutations, account management, approvals, issue, return, stock correction, history.
- Student: inventory reads, own/member project requests, own/member request history, own/member allocations.
- Object-level checks prevent a student guessing another request ID.

### 7.3 CSRF and browser security

Cookie authentication requires CSRF protection on every state-changing request; also validate origin and never use GET for mutations.[16]

- Generate CSRF token after session creation.
- Require it on POST/PATCH/DELETE.
- Restrict allowed origin to the deployed application origin.
- Same-origin deployment avoids broad CORS.
- Use Helmet/security headers and TLS.[6][8]
- Rate-limit login and credential-reset endpoints.
- Return generic authentication errors.
- Never log passwords, session IDs, CSRF tokens, or raw secrets.

### 7.4 Planned files

```text
apps/api/src/modules/auth/
apps/api/src/modules/users/
apps/api/src/middleware/authenticate.ts
apps/api/src/middleware/authorize.ts
apps/api/src/middleware/csrf.ts
apps/api/src/middleware/error-handler.ts
apps/api/src/shared/password.ts
apps/api/src/shared/audit.ts
apps/web/src/features/auth/
apps/web/src/app/guards/
```

### 7.5 TDD sequence

1. Failed login does not reveal whether account exists.
2. Correct login creates a rotated server session.
3. First login requires password change.
4. Inactive user cannot log in.
5. Student cannot access admin endpoint.
6. Student cannot read another student’s personal request.
7. Missing/invalid CSRF token rejects state-changing action.
8. Logout invalidates server-side session.
9. Login rate limit returns 429 after threshold.

### 7.6 Phase 4 exit gate

- Auth flow passes API integration and browser E2E tests.
- No token is stored in localStorage.
- Direct endpoint calls cannot bypass role or ownership checks.
- Security headers and cookie flags are verified in a production-like environment.

---

## 8. Phase 5 — Catalogue, Categories, Locations, and Student Browse Slice

**Estimated effort:** 2–3 focused working days.

**Objective:** Deliver the first visible end-to-end feature: admin creates inventory definitions and students can browse them.

Hierarchical storage is a proven lab pattern: locations can represent buildings, rooms, cabinets, drawers, or shelves.[1][2][3]

### 8.1 Backend tasks

- Category create/edit/archive.
- Location tree create/edit/archive.
- Item create/edit/archive.
- Validate nature/tracking combinations.
- Student item list with filters:
  - Search by name/model
  - Category
  - Returnable/consumable
  - Available only
  - Location
- Admin item list adds tracking mode, inactive records, and low-stock state.
- Item detail returns stock summary without exposing internal-only audit metadata.

### 8.2 Frontend tasks

- Shared app shell and role-based navigation.
- Accessible inventory search/filter form.
- Desktop table with semantic headers and caption.
- Mobile card representation instead of squeezing a wide table.
- Loading skeleton, empty state, retryable error state.
- Item detail screen.

Accessible forms require labels, clear instructions, validation feedback, and success/error notification; accessible data tables require real header/data relationships rather than styling ordinary cells to look like headers.[23][24]

### 8.3 Frontend state rules

- TanStack Query owns server data, caching, loading, and mutation state.[19][20]
- React Hook Form + Zod owns form input and validation.[21]
- Local React state owns temporary UI state.
- Do not add Redux in V1 without a demonstrated need.
- Do not optimistically update stock-changing operations; wait for the server result.

### 8.4 Teammate trial task

Assign one isolated task, preferably the responsive inventory result component:

- Separate feature branch
- Written acceptance criteria
- Loading, empty, error, and populated states
- Keyboard-accessible controls
- Desktop and mobile layouts
- Component tests
- Pull request and code explanation

Responsibility expands only after reliable delivery.

### 8.5 Tests

- Students see only active items.
- Filters combine correctly.
- Archived category/location behavior is safe.
- Search is case-insensitive and paginated.
- Empty and error UI states are accessible.
- Student cannot see admin controls in UI or call admin endpoints.

### 8.6 Phase 5 exit gate

- Admin can create catalogue data and locations.
- Student can log in and browse real API data on desktop and mobile.
- API contract and generated frontend types match.

---

## 9. Phase 6 — Stock Receiving, Units, Movement, and Corrections

**Estimated effort:** 5–7 focused working days.

**Objective:** Make inventory quantities trustworthy before requests can consume them.

InvenTree records a tracking entry whenever stock changes and ties it to the actor; follow that principle without copying its enterprise complexity.[1]

### 9.1 Receiving flow

**Bulk item**

1. Select item and location.
2. Enter positive quantity.
3. Add optional note.
4. Submit one client command ID.
5. In one transaction: create receipt, update balance, append movement, append audit event.

**Serialized item**

1. Select item and location.
2. Enter/generate unique asset codes.
3. Optionally enter manufacturer serials.
4. Validate duplicates before save and in the database.
5. In one transaction: create units, receipt lines/movements, and audit event.

### 9.2 Stock movement rules

- Movement records are append-only.
- Corrections never edit old movements; they append `ADJUST_IN` or `ADJUST_OUT` with a mandatory reason.
- Moving stock between locations creates paired move-out/move-in records in one transaction.
- Archived items cannot receive new stock.
- A duplicate client command ID returns the original result or a deterministic duplicate response; it never doubles stock.

### 9.3 Admin screens

- Receive stock wizard
- Serialized unit entry grid
- Stock balance by location
- Unit list and status
- Move stock
- Correct stock with mandatory reason and confirmation
- Item movement history

### 9.4 High-value tests

- Duplicate receive submission changes stock once.
- Failed movement rolls back all writes.
- Adjustment reason is mandatory.
- Serialized asset code collision is rejected.
- Bulk balance never becomes negative.
- Stock history identifies actor, action, item, quantity, and timestamp.

### 9.5 Phase 6 exit gate

- Admin can receive, move, and correct stock safely.
- Every change has a matching immutable history entry.
- Replaying a request or double-click cannot duplicate stock.

---

## 10. Phase 7 — Projects, Requests, and Admin Decisions

**Estimated effort:** 5–7 focused working days.

**Objective:** Implement demand workflow without yet changing stock.

### 10.1 Project/team behavior

- Admin creates/archives projects in V1.
- Admin manages leader/member list.
- Student sees only projects where active member.
- Archived project cannot receive new requests.
- Existing history remains visible.

### 10.2 Request behavior

- Student selects personal or project target.
- Project request requires active membership.
- Student adds item quantities and short purpose.
- Draft may exist only in browser during V1; submitting creates `PENDING` request.
- Submitted request is immutable; student cancels and creates a new one if wrong.
- Student may cancel only before any issue.
- Admin chooses approved quantity per line.
- Rejection or quantity reduction requires a short reason.
- Approval never changes inventory.
- Admin sees live availability while deciding, but it is advisory until issue.

### 10.3 Status rules

- `PENDING → APPROVED` when every line is fully approved.
- `PENDING → PARTIALLY_APPROVED` when at least one quantity is reduced/rejected and at least one is approved.
- `PENDING → REJECTED` when no line is approved.
- `PENDING/APPROVED/PARTIALLY_APPROVED → CANCELLED` only when nothing has been issued.
- No arbitrary status patch endpoint.

### 10.4 Tests

- Student cannot request inactive/unavailable item.
- Student cannot request against another project.
- Duplicate item lines are normalized or rejected.
- Requested quantity must be positive.
- Approved quantity cannot exceed requested.
- Reduction/rejection requires reason.
- Decision and history commit atomically.
- Approval does not decrement stock.
- Unauthorized ID guessing returns forbidden/not found according to policy.

### 10.5 Phase 7 exit gate

- Student can submit and track a request.
- Admin can make a complete or partial decision.
- Stock remains unchanged until issue.
- Every transition appears in request history.

---

## 11. Phase 8 — Physical Issue, Allocation, Return, and Concurrency

**Estimated effort:** 4–6 focused working days.

**Objective:** Implement the highest-risk stock-changing workflows correctly under concurrent use.

PostgreSQL row locks exist specifically for application-controlled concurrency where ordinary visibility is insufficient.[12] Prisma’s serializable transactions can turn concurrent conflicts into retryable errors; transactions must remain short and contain no network calls.[9]

### 11.1 Issue algorithm

Within one short transaction:

1. Load request and approved remaining quantities.
2. Verify request decision permits issue.
3. Verify collector and target.
4. For each bulk line, atomically decrement only where `available_quantity >= issue_quantity`.
5. For serialized lines, conditionally transition selected units from `AVAILABLE` to `ALLOCATED`.
6. Reject the entire operation on any shortage or stale unit state.
7. Create issue, issue lines, and unit links.
8. Append stock movements and audit event.
9. Commit.
10. Retry bounded serialization conflicts; otherwise return `409 STATE_CONFLICT`.

No email, external API, or slow work runs inside the transaction.

### 11.2 Return algorithm

Within one transaction:

1. Load outstanding returnable quantities/units.
2. Reject returns exceeding outstanding allocation.
3. Create return and line records.
4. Bulk return increments available quantity at chosen/default location.
5. Serialized return transitions:
   - Working/blank condition → `AVAILABLE`
   - Not working → `UNAVAILABLE`
6. Append movements and audit event.
7. Recompute derived fulfilment/allocation state.
8. Commit.

Partial returns are supported because multiple motors or tools may return on different days.

### 11.3 Current allocation queries

- Student: own personal allocations plus project allocations where currently a member.
- Admin: filter by student, project, item, expected return date, and outstanding status.
- Optional expected-return date highlights records but causes no penalty or automatic state transition.

### 11.4 Mandatory concurrency tests

1. Two admins attempt to issue the last bulk unit simultaneously: exactly one succeeds.
2. Two admins attempt to issue the same serialized unit: exactly one succeeds.
3. Duplicate command ID does not create a second issue.
4. Issue failure leaves request, stock, movements, and audit unchanged.
5. Two concurrent returns cannot return more than outstanding.
6. Partial issue never exceeds approved remaining quantity.
7. Partial return never exceeds issued outstanding quantity.

### 11.5 Phase 8 exit gate

- Login → browse → request → decision → issue → allocation → return passes as one E2E flow.
- Stock never becomes negative.
- A physical unit cannot be allocated twice.
- Failures are atomic and return useful conflict errors.

---

## 12. Phase 9 — Kits / Packages

**Estimated effort:** 3–4 focused working days.

**Objective:** Speed up common robotics requests without creating a second inventory model.

### 12.1 Design rule

A kit is a template, not stock. When a student selects a kit:

1. Copy current kit components into ordinary request lines.
2. Let the student review quantities before submission.
3. Freeze submitted request lines even if the kit changes later.
4. Use the normal partial-approval, issue, and return logic.

This avoids special “return an entire kit at once” logic while preserving which kit inspired the request.

### 12.2 Tasks

- Admin creates/edits/archives kits.
- Validate unique item per kit and positive quantity.
- Student adds a kit to request.
- Merge duplicate lines deterministically.
- Show current availability for each component.
- Store optional `source_kit_id` for traceability, but treat copied lines as authoritative.

### 12.3 Tests

- Changing kit later does not change submitted request.
- Archived kit cannot start a new request.
- Duplicate kit items cannot create duplicate stock actions.
- Partial approval behaves exactly like normal request lines.

### 12.4 Phase 9 exit gate

- Basic Robotics Kit can be requested, approved, issued, and returned through existing workflows.
- No independent kit stock exists.

---

## 13. Phase 10 — Dashboards, History, and Operational Usability

**Estimated effort:** 3–4 focused working days.

**Objective:** Answer daily operational questions without adding vanity analytics.

### 13.1 Student dashboard

- Pending request count
- Approved but not issued requests
- Current personal allocations
- Current team/project allocations
- Recent request activity
- Browse inventory shortcut

### 13.2 Admin dashboard

- Pending requests
- Approved but unissued requests
- Current outstanding allocations
- Low-stock items
- Unavailable serialized units
- Recent receipts/issues/returns

### 13.3 History and filters

- Actor
- Action type
- Item/unit
- Student/project
- Location
- Date range
- Request/issue/return reference

Use ordinary indexed database queries. Do not introduce Elasticsearch for this scale.

### 13.4 Search and pagination

- Server-side pagination
- Debounced search input
- Search item name, model, and asset code where relevant
- Explicit filters, not a complex query language
- Stable default ordering
- URL-backed filters for shareable/admin-refresh-safe views

### 13.5 Tests

- Dashboard counts match source records.
- Student never sees another student’s private records.
- Low-stock uses `available <= threshold` and ignores archived items.
- History is immutable and filterable.
- Pagination has no duplicate/missing rows under stable ordering.

### 13.6 Phase 10 exit gate

An admin can answer, without manual calculation:

- What is available?
- Where is it?
- Who has what?
- Which project has what?
- What is awaiting action?
- What is low in stock?
- What changed and who changed it?

---

## 14. Phase 11 — Security, Accessibility, and Reliability Hardening

**Estimated effort:** 4–6 focused working days.

**Objective:** Convert a working prototype into a safe pilot candidate.

### 14.1 Security checklist

- TLS only in production.[6]
- Helmet with reviewed CSP.[8]
- Host-only secure session cookie.[13]
- CSRF protection and origin validation.[16]
- Login/reset rate limits.
- Input validation at every boundary.[17]
- Authorization on every endpoint and object.[15]
- JSON content-type allowlist.
- Generic production errors; no stack traces to clients.[17]
- Secrets only in server environment/secret store.
- Confirm no secret uses a `VITE_` prefix because Vite bundles those values into client code.[22]
- Dependency audit and updates.
- Request size limits.
- Safe structured logging with redaction.
- Database user has only application-required privileges.

### 14.2 Accessibility checklist

- Every input has a visible associated label.
- Required/optional fields are explicit.
- Errors are connected to fields and summarized.
- Success/error notifications are announced.
- Keyboard-only flow works.
- Focus moves correctly after dialogs and submission.
- Color is not the only status indicator.
- Tables use semantic headers/captions.[23][24]
- Mobile actions remain reachable without horizontal interaction traps.

### 14.3 Reliability checklist

- Graceful shutdown closes HTTP and database connections.
- `/health/live` reports process health only.
- `/health/ready` checks database readiness.
- Every request has a correlation ID.
- Stock commands are idempotent.
- Migrations are forward-safe.
- No hard delete of historical entities.
- Time handling is UTC at rest.

### 14.4 Phase 11 exit gate

- Security regression suite passes.
- Keyboard and screen-reader smoke checks pass on critical flows.
- No high/critical unresolved dependency vulnerability without documented acceptance.
- Application restarts without corrupting in-flight stock operations.

---

## 15. Phase 12 — Automated Quality Gates and CI

**Estimated effort:** 2–4 focused working days, introduced incrementally from Phase 2.

**Objective:** Make every merge reproducibly verifiable.

### 15.1 Test pyramid

**Pure unit tests — Vitest**

- Status transition guards
- Quantity calculations
- Kit expansion
- Permission predicates
- Validation schemas
- Error mapping

**API integration tests — Vitest + Supertest + real PostgreSQL**

- Routes, sessions, CSRF, authorization
- Database constraints and transactions
- Complete receive/request/issue/return flows
- Concurrency tests

Do not mock Prisma for stock correctness. Use an isolated PostgreSQL test database.

**React component tests — React Testing Library**

Test visible behavior and accessible controls, not component internals; this matches Testing Library’s user-centred testing principle.[26]

**End-to-end tests — Playwright**

- Admin login and inventory receiving
- Student browse and request
- Admin partial approval
- Physical issue
- Partial return and final return
- Access-control denial
- Concurrent/stale conflict display

Playwright recommends isolated tests, user-facing locators, and web-first assertions.[28]

### 15.2 TDD protocol for every behavior

1. Write one failing behavior test.
2. Run it and confirm the expected failure.
3. Add the smallest implementation.
4. Run the targeted test to green.
5. Run affected package tests.
6. Refactor only while green.
7. Update OpenAPI/docs if behavior changed.
8. Commit.

### 15.3 CI workflow

`.github/workflows/ci.yml` should run:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run contracts:check
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
```

Use a PostgreSQL service container with a health check for integration/E2E CI.[30] Playwright supports CI installation, reports, traces, and running with one worker for stability.[29] Vitest supports TypeScript, component tests, coverage, and CI run mode.[27]

### 15.4 Merge gate

A pull request cannot merge unless:

- OpenAPI is valid and generated types are current.
- Lint/typecheck pass.
- Unit/integration tests pass.
- Production builds pass.
- Required E2E smoke suite passes.
- Reviewer understands any schema or stock-rule change.

Do not chase a vanity 100% coverage number. Require complete behavior coverage for authorization and stock transitions, and use coverage reports to identify gaps.

### 15.5 Phase 12 exit gate

- A clean CI runner can prove the project works without manual machine setup.
- A failing stock or authorization test blocks merge.
- Playwright traces are retained only in trusted CI artifacts.

---

## 16. Phase 13 — Deployment, Backup, and Pilot Rollout

**Estimated effort:** 3–5 focused working days plus the college’s infrastructure lead time.

**Objective:** Put a recoverable pilot in users’ hands.

### 16.1 Environments

```text
local       developer machines, synthetic data
CI          disposable database and browser tests
staging     production-like, synthetic/demo data
production  real lab data
```

Never use real student data in development or public demos.

### 16.2 Recommended deployment

If the college supplies a Linux VM:

```text
Reverse proxy / TLS
  ├─ React static build
  └─ /api → Express container
             └─ private PostgreSQL container/managed DB
```

Docker documents single-server Compose as the easiest production deployment path and recommends production-specific configuration and restart policies.[33] PostgreSQL data must use persistent storage, but the volume itself is not a backup.[34]

If the college provides a managed app/database platform, use its managed PostgreSQL, TLS, secret store, and automated backups instead. Do not force Docker Compose if the institutional platform already solves these needs.

### 16.3 Deployment sequence

1. Verify latest tested image and CI result.
2. Take pre-deployment backup when schema/data changes are involved.
3. Apply committed migrations using `prisma migrate deploy`.[10]
4. Start new application version.
5. Check liveness/readiness.
6. Run smoke tests.
7. Monitor logs and key flows.
8. Keep previous image available for application rollback.

Avoid destructive down-migration automation. Prefer backward-compatible migrations, roll back the application image, and restore from backup only when data cannot be migrated safely.

### 16.4 Backup policy

- Nightly `pg_dump -Fc` for this small V1 database.
- Copy backups off the application server.
- Encrypt backup storage.
- Proposed retention: 7 daily + 4 weekly backups.
- Record backup timestamp, size, checksum, and result.
- Restore into a scratch database monthly and run smoke queries.
- Managed database snapshots supplement but do not replace an understood restore procedure.

PostgreSQL custom-format dumps are compressed and designed for flexible restore with `pg_restore`; a backup is only trustworthy after a successful restore test.[31][32]

### 16.5 Pilot sequence

1. Create one primary admin and one backup admin.
2. Enter 20–30 representative items across serialized/bulk and returnable/consumable types.
3. Create 5–10 pilot student accounts and one project.
4. Run scripted scenarios with the lab in-charge.
5. Record confusion, missing data, and policy gaps.
6. Fix blocking issues only; do not expand scope during pilot.
7. Import/enter remaining inventory after the workflow is accepted.
8. Train admins using a one-page runbook.
9. Define support owner and escalation route.
10. Obtain written pilot acceptance.

### 16.6 Production acceptance scenarios

- Receive a bulk consumable and see quantity increase once.
- Receive serialized returnable units with unique asset IDs.
- Student finds and requests personal items.
- Student requests for an authorized project.
- Admin partially approves with reason.
- Approval does not alter stock.
- Admin issues bulk and serialized items atomically.
- Concurrent issue attempt cannot oversell.
- Student sees current allocation.
- Admin partially returns an allocation.
- Unusable returned unit becomes unavailable.
- Final return restores availability.
- Inactive student cannot log in.
- History shows every actor and transition.
- Backup restores into a clean database.

### 16.7 Phase 13 exit gate

- Production deployment is reproducible.
- Backup and restore are proven.
- Lab staff complete acceptance scenarios.
- Named owner receives runbooks and credentials through a secure channel.
- V1 acceptance is recorded before V1.1 work begins.

---

## 17. API and Domain Implementation Rules

These rules apply throughout every phase.

### 17.1 Server is authoritative

Frontend never decides:

- Whether a user may access a record
- Whether a request transition is valid
- How much stock is available
- Whether a unit can be issued
- Whether a return exceeds outstanding quantity
- What history/audit record to create

The frontend may hide unavailable actions for usability, but the API must independently reject them.

### 17.2 Do not expose generic mutation endpoints

Avoid:

```text
PATCH /requests/:id { status: "APPROVED" }
PATCH /units/:id { status: "AVAILABLE" }
```

Prefer:

```text
POST /requests/:id/decision
POST /issues
POST /returns
POST /units/:id/mark-unavailable
```

Action endpoints make allowed transitions explicit and testable.

### 17.3 Current state plus immutable history, not event sourcing

- Current-state tables make everyday reads simple.
- Stock movements and audit events preserve history.
- Both update in the same transaction.
- Do not rebuild the entire database from events in V1.

### 17.4 Archive rather than delete

Users, projects, items, locations, categories, and kits become inactive/archived once referenced. This protects reports and audit history.

### 17.5 Stable errors

Frontend logic uses stable error codes, not English message matching:

```text
VALIDATION_ERROR
AUTH_REQUIRED
FORBIDDEN
NOT_FOUND
INVALID_STATE_TRANSITION
INSUFFICIENT_STOCK
UNIT_NOT_AVAILABLE
DUPLICATE_COMMAND
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

---

## 18. Detailed Testing Matrix

| Area | Happy path | Boundary/failure | Security/concurrency |
|---|---|---|---|
| Login | Active user logs in | Wrong password, inactive account, forced password change | Rate limit, session rotation, CSRF |
| Catalogue | Active items listed | Archived item hidden, invalid filters | Student cannot mutate |
| Receiving | Quantity/unit added | Duplicate asset ID, invalid location | Duplicate command ID |
| Requests | Personal/project submit | Zero quantity, inactive item, unauthorized project | Read another student’s request |
| Decision | Full/partial/reject | Approve above request, missing reason | Student calls admin action |
| Issue bulk | Stock decrements | Insufficient stock | Two admins race for final stock |
| Issue serialized | Unit allocated | Unit unavailable | Two admins race for same unit |
| Return | Availability restored | Over-return, wrong issue | Duplicate return command |
| Kits | Lines expand | Archived/duplicate line | Kit change does not alter old request |
| History | Actor/action visible | Filter boundaries | No update/delete endpoint |
| UI | Forms and tables work | Loading/empty/error | Keyboard access, forbidden routes |
| Deployment | Healthy startup | DB unavailable, bad env | Secrets absent from client/logs |
| Backup | Dump created | Bad/corrupt file detected | Restore proves usability |

---

## 19. Documentation Deliverables

Keep documentation updated as implementation advances:

- `Project.md` — living source of truth and change log
- `README.md` — setup and common commands
- `docs/product-decisions.md` — approved policies
- `docs/domain-glossary.md` — canonical language
- `docs/workflows.md` — user and state flows
- `docs/status-transitions.md` — allowed transitions
- `docs/architecture.md` — system boundaries and diagrams
- `docs/schema.md` — entities, constraints, indexes
- `docs/api.md` plus `packages/contracts/openapi.yaml`
- `docs/security.md` — threat model and controls
- `docs/testing/strategy.md`
- `docs/runbooks/deploy.md`
- `docs/runbooks/backup-restore.md`
- `docs/runbooks/admin-operations.md`
- `docs/pilot-acceptance.md`

Every completed feature requires:

1. Behavior tests
2. API contract update where applicable
3. Relevant documentation update
4. `Project.md` status/change-log update
5. Real verification output before it is marked complete

---

## 20. AI-Assisted Development Rules

AI may accelerate implementation, but it must not become an unreviewed code generator.

For every AI-produced change:

- Start from a written task and acceptance criteria.
- Require tests before production behavior.
- Inspect the diff.
- Run targeted and full relevant tests.
- Ask for explanation when the user is in Learning mode.
- Reject unnecessary dependencies and abstractions.
- Never allow AI to invent a new status, field, or workflow outside the approved contract.
- Never allow AI to alter secrets, providers, deployment targets, or product scope silently.
- Keep commits small enough to understand and revert.

A feature is not complete because code exists. It is complete only when the real workflow runs, tests pass, documentation matches, and the user can explain the important behavior.

---

## 21. Teammate Contribution Plan

### Stage A — Research evidence

- Structured comparison of exactly three relevant systems
- Deadline and required template
- No project dependency on completion

### Stage B — One trial pull request

Recommended task: responsive inventory results with loading, empty, error, and populated states.

Acceptance criteria:

- Separate branch
- No direct main push
- Reuses existing API types/components
- Keyboard accessible
- Desktop/mobile verified
- Component tests included
- Can explain the implementation

### Stage C — Responsibility based on evidence

- Reliable delivery: own one student-facing feature at a time.
- Partial delivery: keep to isolated components with review.
- No delivery: remain optional contributor; project continues without dependency.

This is fairer and safer than either excluding him immediately or giving vague unrestricted frontend access.

---

## 22. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Scope grows into enterprise inventory | High | High | Enforce V1 non-goals and change control |
| User takes on too much alone | High | High | Vertical milestones, bounded tasks, weekly demos |
| AI-generated code is not understood | High | High | Small diffs, Learning mode, tests, explanation requirement |
| Negative stock/double allocation | Medium | Critical | DB constraints, atomic conditional writes, transactions, race tests |
| Frontend/backend contract drift | Medium | High | OpenAPI-first contract and generated types |
| Teammate blocks progress | Medium | Medium | No critical-path dependency; trial tasks only |
| Teammate edits break code | Medium | Medium | Protected main, branches, PR review, CI |
| Session/auth mistake | Medium | High | Same-origin opaque sessions, CSRF, secure cookies, OWASP checks |
| Data loss | Medium | Critical | Off-host backups and restore drills |
| Unknown hosting blocks release | High | High | Resolve in Phase 0; staging early |
| Initial inventory entry is too slow | Medium | Medium | Confirm spreadsheet early; add CSV import only if justified |
| Status model becomes inconsistent | Medium | High | Canonical enums and transition tests |
| Mobile admin workflow is awkward | Medium | Medium | Pilot on actual phones/tablets; card layouts for narrow screens |

---

## 23. Definition of Done for the Complete Project

The complete V1 is done only when all are true:

- [ ] Approved requirements and status transitions are documented.
- [ ] Fresh clone setup works from README.
- [ ] Admin and student authentication works securely.
- [ ] Server enforces role and object-level authorization.
- [ ] Admin can define locations, categories, items, and serialized units.
- [ ] Admin can receive bulk and serialized stock.
- [ ] Students can search inventory and request personally or for a project.
- [ ] Admin can approve, partially approve, reject, and cancel correctly.
- [ ] Approval does not change stock.
- [ ] Physical issue atomically changes stock.
- [ ] Returnable allocations can be partially and fully returned.
- [ ] Consumables cannot be returned.
- [ ] Kits expand safely into request lines.
- [ ] Current allocations, low stock, and history are accurate.
- [ ] Race-condition and idempotency tests pass.
- [ ] Critical component and E2E tests pass.
- [ ] CI gates every pull request.
- [ ] Production uses HTTPS and secure session settings.
- [ ] Database is not publicly exposed.
- [ ] Backup has been restored successfully.
- [ ] Pilot users complete acceptance scenarios.
- [ ] Admin runbook and ownership handoff are complete.
- [ ] `Project.md` reflects the shipped architecture and verified status.

---

## 24. Recommended Execution Order

Do not start by building all dashboards. Execute in this sequence:

```text
0. Confirm policy decisions
1. Freeze vocabulary, transitions, wireframes, and OpenAPI skeleton
2. Create repository, local database, test harness, and CI
3. Create schema, migrations, constraints, and seed
4. Build secure login/session/authorization
5. Build catalogue + student browse vertical slice
6. Build receiving + stock history
7. Build projects + request + decision
8. Build physical issue + return with concurrency protection
9. Add kits using existing request flow
10. Add operational dashboards and history filters
11. Harden security, accessibility, and reliability
12. Complete CI/E2E gates
13. Deploy staging, prove backup restore, run pilot, then production
```

The first implementation session should therefore be **Phase 0 only**: resolve the genuine product decisions and write the canonical workflow/status documents. Repository scaffolding starts only after that review.

## Sources

[1] https://docs.inventree.org/en/stable/stock — InvenTree Stock Items
[2] https://doc.elabftw.net/docs/usage/inventory — eLabFTW Inventory
[3] https://help.nuilab.org/systems/inventory/loans-and-locations — NUILab Locations and Loans
[4] https://lab.wempec.wisc.edu/how-to/how-to-check-out-equipment — WEMPEC Equipment Checkout
[5] https://nodejs.org/en/about/previous-releases — Node.js Releases
[6] https://expressjs.com/en/advanced/best-practice-security — Express Production Security
[7] https://expressjs.com/en/resources/middleware/session — Express Session Middleware
[8] https://helmetjs.github.io — Helmet.js
[9] https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions.md — Prisma Transactions
[10] https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production.md — Prisma Migrate Development and Production
[11] https://www.postgresql.org/docs/current/ddl-constraints.html — PostgreSQL Constraints
[12] https://www.postgresql.org/docs/current/explicit-locking.html — PostgreSQL Explicit Locking
[13] https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html — OWASP Session Management
[14] https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html — OWASP Password Storage
[15] https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html — OWASP Authorization
[16] https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html — OWASP CSRF Prevention
[17] https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html — OWASP REST Security
[18] https://react.dev/learn/typescript — React with TypeScript
[19] https://tanstack.com/query/latest/docs/framework/react/guides/queries — TanStack Query Queries
[20] https://tanstack.com/query/latest/docs/framework/react/guides/mutations — TanStack Query Mutations
[21] https://react-hook-form.com/get-started — React Hook Form
[22] https://vite.dev/guide/env-and-mode — Vite Environment Variables
[23] https://www.w3.org/WAI/tutorials/forms — W3C Accessible Forms
[24] https://www.w3.org/WAI/tutorials/tables — W3C Accessible Tables
[25] https://spec.openapis.org/oas/latest.html — OpenAPI Specification
[26] https://testing-library.com/docs/react-testing-library/intro — React Testing Library
[27] https://vitest.dev/guide/features — Vitest Features
[28] https://playwright.dev/docs/best-practices — Playwright Best Practices
[29] https://playwright.dev/docs/ci — Playwright CI
[30] https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers — GitHub Actions PostgreSQL Service Containers
[31] https://www.postgresql.org/docs/current/app-pgdump.html — PostgreSQL pg_dump
[32] https://www.postgresql.org/docs/current/app-pgrestore.html — PostgreSQL pg_restore
[33] https://docs.docker.com/compose/how-tos/production — Docker Compose Production
[34] https://docs.docker.com/engine/storage/volumes — Docker Volumes
[35] https://openapi-ts.dev/openapi-fetch — OpenAPI TypeScript Fetch Client
