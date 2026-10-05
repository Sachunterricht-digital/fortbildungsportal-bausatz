#!/usr/bin/env bash
# Testinstanz auf einem eigenen Server bedienen (Beispielskript).
#   TEST_SSH_HOST   SSH-Alias oder Host des Testservers (Standard: testserver)
#   TEST_ZIEL       Ordner auf dem Server (Standard: /opt/fortbildung-test)
#
#   scripts/testinstanz.sh spiegeln   Code von diesem Rechner auf den Server und neu bauen
#   scripts/testinstanz.sh zuruecksetzen  Datenbank wegwerfen, frisch aufsetzen und seeden
#   scripts/testinstanz.sh tunnel     SSH-Tunnel öffnen, danach http://localhost:3101
#   scripts/testinstanz.sh stand      Was läuft gerade
#
# Die echte Seite liegt in einem anderen Ordner und wird davon nie berührt.
set -euo pipefail

SSH_HOST="${TEST_SSH_HOST:-testserver}"
ZIEL="${TEST_ZIEL:-/opt/fortbildung-test}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.test.yml"
hier="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "${1:-stand}" in
  spiegeln)
    rsync -az --delete \
      --exclude .env --exclude node_modules --exclude .next --exclude .git \
      --exclude docker-compose.override.yml \
      "$hier/" "$SSH_HOST:$ZIEL/"
    ssh "$SSH_HOST" "cd $ZIEL && $COMPOSE build app && $COMPOSE up -d"
    ;;
  zuruecksetzen)
    ssh "$SSH_HOST" "cd $ZIEL && $COMPOSE down -v && $COMPOSE up -d && sleep 12 && \
      docker build -q --target builder -t fortbildung-test:builder . >/dev/null && \
      set -a && . ./.env && set +a && \
      docker run --rm --network fortbildung-test_default \
        -e DATABASE_URL=\"postgresql://fortbildungen:\${POSTGRES_PASSWORD}@db:5432/fortbildungen_uamm?schema=public\" \
        -e SEED_ADMIN_EMAIL=\"\${SEED_ADMIN_EMAIL}\" -e SEED_ADMIN_PASSWORD=\"\${SEED_ADMIN_PASSWORD}\" \
        -e SEED_ADMIN_NAME=\"\${SEED_ADMIN_NAME}\" -e SCHULAMT_STARTPROFIL=\"\${SCHULAMT_STARTPROFIL:-}\" \
        fortbildung-test:builder npx prisma db seed"
    ;;
  tunnel)
    echo "Tunnel offen, Seite unter http://localhost:3101 — beenden mit Strg+C"
    ssh -N -L 3101:127.0.0.1:3101 "$SSH_HOST"
    ;;
  stand)
    ssh "$SSH_HOST" "cd $ZIEL && $COMPOSE ps"
    ;;
  *)
    echo "Unbekannt: $1" >&2
    exit 1
    ;;
esac
