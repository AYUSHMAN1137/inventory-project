# E2E Testing

Browser tests for the lab inventory app, driven by Playwright against the **real**
Express + Prisma backend. Nothing is mocked — mocking the API would only test our
own fixtures.

## Run

```bash
npm run test:e2e          # all specs, headless
npm run test:e2e:ui       # interactive runner
npm run test:e2e:report   # open the last HTML report
```

`playwright.config.ts` starts two servers automatically:

1. **API** — `e2e/start-api.mjs` creates a fresh `apps/api/prisma/e2e.db`, seeds it,
   then boots the API on port 4000 against that database.
2. **Web** — the Vite dev server on port 5173, which proxies `/api` to the API.

Your `dev.db` is never touched.

## Isolation

Each spec file calls `resetDatabase()` (see `reset-db.ts`) in `beforeAll`, which
clears every table and re-seeds. This makes files order-independent: the intake
spec can create catalogue items without breaking the catalogue spec's counts.

Assertions should still avoid hardcoding totals where a spec can add rows — assert
the *shape* (`N of N catalogue items`) rather than the literal 36.

## Specs

| File | Covers |
|---|---|
| `auth.spec.ts` | Signed-out gate, bad credentials, login, session persistence across reload, logout, role separation, admin route protection, every admin screen renders |
| `catalog.spec.ts` | Catalogue load, search, category/nature filters, card↔table views, item detail drawer, student cart → submit, quantity editing, validation, admin approve/reject |
| `lifecycle.spec.ts` | The full chain with **stock assertions**: request → approve (stock unchanged) → issue (stock −1) → return (stock restored). Plus ledger contents and CSV export |
| `admin.spec.ts` | Kits + bill of materials, kit→cart, lab layout drill-down, stock intake receipt (verified against stock), new catalogue item, users/projects, responsive behaviour |
| `password.spec.ts` | Admin provisions an account → temporary password lands on the forced-change screen → weak/incorrect passwords refused → rotation releases the account → the old password stops working → other sessions are revoked. Also asserts no demo shortcut and no bundled seed password remain in the bundle |

## Notes / pitfalls

- Sidebar links carry badge counts (`"Request Queue 3"`), so match with a prefix
  regex — see `navLink()` in `helpers.ts` — not an exact name.
- Overlay footers share button labels with in-body helpers (`"Approve all"` appears
  twice), so `confirmOverlay()` targets the footer specifically.
- The API holds an open handle on `e2e.db`, so the reset clears tables rather than
  deleting the file.
- On a mobile viewport the sidebar is behind a drawer (`data-testid="mobile-nav"`);
  the desktop rail stays in the DOM but hidden.
