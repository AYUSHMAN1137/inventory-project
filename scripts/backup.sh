#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/deeptech_inventory_${STAMP}.dump"

pg_dump --format=custom --no-owner --no-acl --file="$FILE" "$DATABASE_URL"
sha256sum "$FILE" > "$FILE.sha256"
printf 'Backup written to %s\n' "$FILE"
