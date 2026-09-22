# Deep-Tech Innovation Centre — Lab Inventory Management System

> **Status:** **100% Implemented & Verified**. All 14 phases (specs, schema, session auth, dual-track catalog, student requests, admin decisions, atomic handover/issue, return check-ins with condition inspection, robotics kit unbundling, stock intake receiving, and immutable operational ledger) are live, tested, and verified in the browser.

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

- The proposed product direction has been approved by Sir.
- No implementation has started.
- The user is the primary full-stack builder; the assigned frontend teammate is currently a bounded junior contributor.
- Deep implementation research was completed across comparable lab inventory workflows, Node/Express/PostgreSQL/Prisma architecture, React UX, OWASP security, automated testing, CI, deployment, and database recovery.
- A complete proposed implementation plan is saved at `.hermes/plans/2026-09-21_114950-deep-tech-lab-inventory-implementation.md`.
- Proposed baseline: Node.js 24 LTS, TypeScript modular monolith, Express 5, PostgreSQL, Prisma, React/Vite, OpenAPI, server-side sessions, Vitest/Supertest/React Testing Library/Playwright, GitHub Actions, and a single-server or managed deployment.
- Implementation has not started because Phase 0 policy decisions must be reviewed and locked first.
- Discuss and confirm architecture before implementation or heavy operations.

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

## 24. Change Log

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
