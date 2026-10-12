# Production Operations

## Runtime

- Node.js 22 LTS
- PostgreSQL 16+
- Same-origin HTTPS reverse proxy
- Required variables: `DATABASE_URL`, `APP_ORIGIN`, `SESSION_SECRET`, `NODE_ENV=production`
- `SESSION_SECRET` must be **at least 32 characters** and unique per environment. Generate one with
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and store it in the
  platform's secret manager — never in source control.
- `LOG_LEVEL` (`fatal` | `error` | `warn` | `info` | `debug` | `trace`) controls verbosity. Use `info` or
  `warn` in production. Logs are JSON lines, one object per event, each carrying a `requestId`.
- The process refuses to start if the configuration is invalid — see [apps/api/src/env.ts](../apps/api/src/env.ts).
  A fast crash at deploy time is deliberate; it replaces a silently misconfigured service in production.
- Never place credentials in source control. Use the deployment platform's secret store. `.env.example`
  documents every supported variable and is the only env file allowed in the repository.

## Deploy

1. Provision an empty PostgreSQL database and a least-privilege application user.
2. Set `DATABASE_URL` and `APP_ORIGIN`.
3. Build the container: `docker compose build`.
4. Apply migrations: `npx prisma migrate deploy --schema apps/api/prisma/schema.postgresql.prisma`.
5. Start: `docker compose up -d`.
6. Verify `GET /api/v1/health/live` and `GET /api/v1/health/ready` return HTTP 200.
7. Sign in with a separately provisioned admin account and run a receive → request → approve → issue → return smoke test.
8. Confirm the admin is forced through `PATCH /api/v1/auth/password` on first sign-in (`mustChangePassword`
   is `true` on every admin-provisioned account), and that a mutation returns
   `403 PASSWORD_CHANGE_REQUIRED` until that change completes.

## Shutdown and restarts

The API handles `SIGTERM` and `SIGINT`: it stops accepting connections, waits for in-flight requests,
disconnects Prisma and exits. A forced exit happens 10 seconds after the signal if connections do not
drain. `unhandledRejection` and `uncaughtException` are logged with a stack trace before exit, so a
container orchestrator restarts a clean process instead of leaving a broken one alive.

The application container must sit behind TLS in production. Do not expose PostgreSQL publicly.

## Backups

Run `scripts/backup.sh` daily with `DATABASE_URL` and an off-host `BACKUP_DIR`. It creates a PostgreSQL custom-format dump and SHA-256 checksum. Encrypt and copy backups off the application host. Retain daily backups for 14 days and monthly backups for 12 months unless college policy says otherwise.

Example:

```bash
DATABASE_URL='postgresql://...' BACKUP_DIR='/srv/backups' bash scripts/backup.sh
```

## Restore drill

Use a new, empty drill database—never production:

```bash
DATABASE_URL='postgresql://.../deeptech_restore_drill' bash scripts/restore.sh /srv/backups/deeptech_inventory_<timestamp>.dump
psql "$DATABASE_URL" -c 'SELECT COUNT(*) FROM "StockMovement";'
```

Verify login, inventory counts, allocations, and the movement ledger. Record the drill date, backup filename, checksum result, row counts, duration, and operator. A backup is not considered proven until this drill succeeds.

## Rollback

Application rollback means redeploying the prior image. Database migrations are forward-only by default: take a backup before migration and restore only after a documented incident decision. Do not manually delete movement or audit rows.

## Incident checks

1. Check readiness and application logs.
2. Confirm database connectivity and disk capacity.
3. Stop writes before restoring data.
4. Preserve logs and the affected database snapshot.
5. Rotate credentials if exposure is suspected.
