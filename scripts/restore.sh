#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set to the restore target}"
BACKUP_FILE="${1:?Usage: restore.sh <backup.dump>}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  printf 'Backup not found: %s\n' "$BACKUP_FILE" >&2
  exit 1
fi

if [[ -f "$BACKUP_FILE.sha256" ]]; then
  sha256sum --check "$BACKUP_FILE.sha256"
fi

pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$BACKUP_FILE"
printf 'Restore completed from %s\n' "$BACKUP_FILE"
