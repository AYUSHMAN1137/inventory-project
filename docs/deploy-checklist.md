# Release Checklist — local complete → first deployment

> Ye gate **deployment se ek step pehle** ka hai. Neeche sab tick ho jaye, tab hi deploy karna.
> Har item local machine pe verify kiya ja sakta hai — koi server access nahi chahiye.

## 1. Automated verification — sab green

- [ ] `npm run lint` — 0 errors
- [ ] `npm run typecheck --workspaces` — 0 errors (api + web + contracts)
- [ ] `npm test --workspaces` — API aur web vitest dono pass
- [ ] `npm run build --workspaces` — api `tsc` aur web `tsc && vite build` dono succeed
- [ ] `npx playwright test` — E2E suite green (dev servers :4000/:5173 pehle band kare)
- [ ] `npm audit --omit=dev` — 0 vulnerabilities
- [ ] `npm run generate:contracts` → `packages/contracts/generated/api.d.ts` me koi diff nahi
      (yaani `openapi.yaml` aur generated types sync me hain)

## 2. Demo/dangerous code removed

- [ ] `apps/web/src` me `Password@123` / `loginAs` / `switchIdentity` / `DEMO_` — koi match nahi
- [ ] Topbar me role-switch button nahi hai (asli logout → login hi hai)
- [ ] `VITE_SHOW_DEMO_HINTS` production build me `false` ya absent hai
- [ ] Repo me `cookies.txt`, `implementation-plan-report.md`, junk research docs nahi hain
- [ ] `git status` saaf — koi untracked scratch script nahi (`scratch-*.mjs` delete ho chuka)

## 3. Configuration & secrets

- [ ] `.env.example` commit hai, asli `.env` **gitignored** hai
- [ ] Production `SESSION_SECRET` ≥ 32 chars, unique, secret store me hai — repo me nahi
- [ ] `DATABASE_URL` production Postgres ka hai (SQLite dev-only)
- [ ] `APP_ORIGIN` production URL pe set hai; CORS dev origin (`WEB_ORIGIN`) ko allow karta hai
- [ ] `NODE_ENV=production`, `LOG_LEVEL=info` (ya `warn`)
- [ ] `VITE_*` me koi secret nahi — bundle public hota hai

## 4. Database & migrations

- [ ] Postgres migrations `apps/api/prisma/migrations/` me hain aur
      `npx prisma migrate deploy --schema apps/api/prisma/schema.postgresql.prisma` locally verify ho chuka
- [ ] Backup liya gaya migration se **pehle** ([scripts/backup.sh](../scripts/backup.sh))
- [ ] Restore drill ek naye, khaali drill DB pe safal raha (see [operations.md](./operations.md))

## 5. Security

- [ ] Admin account production me provision kiya — seed admin `ADMIN001` production DB me **nahi** hai
- [ ] Sabhi admin-provisioned accounts pe `mustChangePassword` true hai (server enforce karta hai)
- [ ] TLS reverse proxy configured hai, app container direct expose nahi
- [ ] PostgreSQL publicly exposed nahi; least-privilege app user
- [ ] Password change end-to-end test kiya: `PATCH /api/v1/auth/password` se baaki sessions revoke hote hain
- [ ] 403 `PASSWORD_CHANGE_REQUIRED` mutations pe aa raha hai jab tak password rotate na ho

## 6. Runtime smoke test (production shape)

- [ ] `GET /api/v1/health/live` → 200
- [ ] `GET /api/v1/health/ready` → 200 (DB connectivity)
- [ ] Full cycle ek asli browser me: login → forced password change → receive stock → request →
      approve → **issue (stock badla)** → return (condition graded) → ledger row dikha
- [ ] Idempotency replay check: same `clientCommandId` dobara bhejo → double movement nahi banti
- [ ] Error path: galat password pe 401, session intact rehta hai, error announce hota hai
- [ ] Logs JSON me aa rahe hain, har request pe `requestId` hai, stack trace client ko leak nahi
- [ ] Graceful shutdown test kiya: `docker stop` pe clean exit

## 7. Rollback plan ready

- [ ] Previous image tag identified hai
- [ ] Rollback = purana image redeploy; DB migrations forward-only, backup restore se pehle
      documented incident decision
- [ ] Logs aur affected DB snapshot preserve karne ka process likha hai

---

**Sign-off:** developer ______________ · date ______________
Deployment is not started while any box above is unticked.
