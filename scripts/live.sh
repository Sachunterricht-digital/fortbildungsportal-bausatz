#!/usr/bin/env bash
# Live-Seite auf dem eigenen Server bedienen. Jeder Deploy endet mit dem Klicktest.
#
# Beispielskript: Server, Pfad und Adresse kommen aus Umgebungsvariablen.
#   LIVE_SSH_HOST   SSH-Alias oder Host des Servers (Standard: liveserver)
#   LIVE_ZIEL       Ordner auf dem Server mit docker-compose.yml (Standard: /opt/fortbildung)
#   LIVE_URL        Adresse der Live-Seite (Standard: https://fortbildung.example.org)
#   LIVE_ADMIN_MAIL Mailadresse des Admin-Kontos (Standard: admin@example.org)
#   LIVE_ZWEIG      Git-Zweig, von dem deployt wird (Standard: main)
#   LIVE_ADMIN_PW   Passwort des Admin-Kontos für den Klicktest
#
#   scripts/live.sh aktiv            Wer war in den letzten 30 Minuten aktiv (AuditLog, ohne Anmeldungen des Admin-Kontos)
#   scripts/live.sh backup <name>    pg_dump nach /root/backup/fortbildung-<zeit>-<name>.sql.gz
#   scripts/live.sh deploy <name>    Prüfen, Backup, rsync (mit Löschprüfung), bauen, starten, Klicktest
#   scripts/live.sh klicktest        Nur den Klicktest gegen die Live-Seite
#   LIVE_JA=1 vor deploy überspringt die Rückfrage (für Agenten, Aktivität vorher selbst ansehen)
#
# Der Backupname darf nur A-Z a-z 0-9 . _ - enthalten (höchstens 60 Zeichen).
#
# Der Klicktest liest nur, bis auf die Anmeldung (lastLoginAt, LOGIN im AuditLog
# des Admin-Kontos). Er legt sonst nichts an, ändert nichts, verschickt keine Mails
# und fotografiert keine Admin-Seiten.
set -euo pipefail

SSH_HOST="${LIVE_SSH_HOST:-liveserver}"
ZIEL="${LIVE_ZIEL:-/opt/fortbildung}"
export LIVE_URL="${LIVE_URL:-https://fortbildung.example.org}"
export LIVE_SSH_HOST="$SSH_HOST" LIVE_ZIEL="$ZIEL"
DEPLOY_ZWEIG="${LIVE_ZWEIG:-main}"
hier="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_MAIL="$(printf '%s' "${LIVE_ADMIN_MAIL:-admin@example.org}" | tr '[:upper:]' '[:lower:]')"

# Was rsync nie anfasst und nie löscht (gilt für Prüfung und echten Lauf)
# (--delete-before statt --delete: Das macOS-rsync (openrsync) listet Löschungen
# im Trockenlauf sonst nicht auf.)
RSYNC_OPTIONEN=(-az --delete-before
  --exclude .env --exclude node_modules --exclude .next --exclude .git
  --exclude docker-compose.override.yml --exclude Caddyfile
  --exclude scripts/e2e/bilder)

# Backupname: strikt, bevor irgendetwas an den Server geht.
pruefe_backupname() {
  local name="${1:-}"
  if ! [[ "$name" =~ ^[A-Za-z0-9._-]{1,60}$ ]]; then
    echo "Abbruch: Backupname fehlt oder ist ungültig (erlaubt: A-Z a-z 0-9 . _ - , höchstens 60 Zeichen): '$name'" >&2
    return 1
  fi
}

aktiv() {
  # Der Klicktest meldet das Admin-Konto an: Diese LOGIN-Einträge blenden wir
  # aus, sonst zeigt sich jeder Deploy als Aktivität. Alles andere bleibt sichtbar.
  if ! [[ "$ADMIN_MAIL" =~ ^[a-z0-9._@+-]+$ ]]; then
    echo "Abbruch: LIVE_ADMIN_MAIL enthält ungültige Zeichen" >&2
    return 1
  fi
  ssh "$SSH_HOST" "cd $ZIEL && docker compose exec -T db psql -U fortbildungen -d fortbildungen_uamm -At -F ' | ' -c \"
    SELECT to_char(a.at AT TIME ZONE 'Europe/Berlin', 'HH24:MI'), coalesce(u.email, '-'), a.aktion, a.entitaet
    FROM \\\"AuditLog\\\" a LEFT JOIN \\\"User\\\" u ON u.id = a.\\\"userId\\\"
    WHERE a.at > now() - interval '30 minutes'
      AND NOT (a.aktion = 'LOGIN' AND lower(coalesce(u.email, '')) = '$ADMIN_MAIL')
    ORDER BY a.at DESC LIMIT 20\""
}

# Läuft auf dem Server. pipefail, damit ein gescheiterter pg_dump nicht von
# gzip überdeckt wird. Der Dump entsteht unter einem Tempnamen, wird geprüft
# (gzip -t, Endmarke von pg_dump, Mindestgröße) und erst dann atomar umbenannt.
# Kein einfaches Anführungszeichen in diesem Text: Er steht in '...' im ssh-Befehl.
REMOTE_BACKUP='set -eu
cd "$1"
tmp="$2.tmp"
trap "rm -f \"$tmp\"" EXIT
docker compose exec -T db pg_dump -U fortbildungen fortbildungen_uamm | gzip > "$tmp"
gzip -t "$tmp"
gzip -dc "$tmp" | tail -n 5 | grep -q "PostgreSQL database dump complete"
groesse=$(wc -c < "$tmp" | tr -d " ")
if [ "$groesse" -lt 4096 ]; then echo "Backup zu klein ($groesse Bytes)" >&2; exit 1; fi
mv "$tmp" "$2"
ls -lh "$2"'

backup() {
  local name="${1:-}"
  pruefe_backupname "$name" || return 1
  local datei="/root/backup/fortbildung-$(date +%Y-%m-%d-%H%M)-$name.sql.gz"
  case "$REMOTE_BACKUP" in *\'*) echo "Interner Fehler: einfaches Anführungszeichen im Remote-Skript" >&2; return 1 ;; esac
  ssh "$SSH_HOST" "bash -o pipefail -c '$REMOTE_BACKUP' bash '$ZIEL' '$datei'"
}

# Liest die Löschliste von rsync (Zeilen "*deleting pfad") von stdin und gibt
# die Pfade aus, die in der Git-Historie nie vorkamen: serverseitige Fremddateien.
# Ein Verzeichnis zählt als bekannt, wenn darunter einmal etwas im Repo stand.
fremde_loeschungen() {
  local historie
  historie="$(mktemp)"
  git -C "$hier" log --all --name-only --pretty=format: --no-renames | sed '/^$/d' | sort -u > "$historie"
  sed -n 's/^\*deleting  *//p' | awk -v hist="$historie" '
    BEGIN {
      while ((getline zeile < hist) > 0) {
        datei[zeile] = 1
        n = split(zeile, teile, "/"); pfad = ""
        for (i = 1; i < n; i++) { pfad = pfad teile[i] "/"; ordner[pfad] = 1 }
      }
    }
    { if (!($0 in datei) && !($0 in ordner)) print $0 }'
  rm -f "$historie"
}

# Trockenlauf von rsync: zeigt, was auf dem Server gelöscht würde, und bricht ab,
# wenn dabei Dateien fallen, die nie im Repo standen.
rsync_pruefen() {
  local ausgabe loeschliste fremd
  # Schlägt rsync selbst fehl (SSH, Rechte), bricht der Deploy ab und fährt nicht weiter.
  ausgabe="$(rsync "${RSYNC_OPTIONEN[@]}" --dry-run --itemize-changes --8-bit-output "$hier/" "$SSH_HOST:$ZIEL/")" \
    || { echo "Abbruch: rsync-Trockenlauf fehlgeschlagen" >&2; return 1; }
  loeschliste="$(printf '%s\n' "$ausgabe" | grep '^\*deleting' || true)"
  echo "== rsync Trockenlauf: Dateien, die auf dem Server gelöscht würden"
  if [ -z "$loeschliste" ]; then echo "(keine)"; return 0; fi
  echo "$loeschliste"
  fremd="$(printf '%s\n' "$loeschliste" | fremde_loeschungen)" || return 1
  if [ -n "$fremd" ]; then
    echo "Abbruch: Diese Pfade liegen nur auf dem Server und standen nie im Git-Repo:" >&2
    echo "$fremd" >&2
    echo "Hinweis: Entweder sichern und aufnehmen (ins Repo) oder in RSYNC_OPTIONEN in scripts/live.sh ausschließen." >&2
    return 1
  fi
}

# Doppelte Termine einer Umfrage würden die Migration umfrage_termin_unique scheitern lassen.
pruefe_termin_dubletten() {
  local anzahl
  anzahl="$(ssh "$SSH_HOST" "cd $ZIEL && docker compose exec -T db psql -U fortbildungen -d fortbildungen_uamm -At -c \"
    SELECT count(*) FROM (SELECT 1 FROM \\\"UmfrageTermin\\\" GROUP BY \\\"umfrageId\\\", \\\"datum\\\" HAVING count(*) > 1) d\"")"
  if [ "$anzahl" != "0" ]; then
    echo "Abbruch: $anzahl doppelte Umfragetermine (umfrageId, datum) auf live, die Migration umfrage_termin_unique würde scheitern" >&2
    return 1
  fi
}

klicktest() {
  node "$hier/scripts/e2e/live-klicktest.mjs"
}

case "${1:-}" in
  aktiv) aktiv ;;
  backup) backup "${2:-}" ;;
  klicktest) klicktest ;;
  loeschliste-pruefen) fremde_loeschungen ;;  # Testhilfe: rsync-Löschliste von stdin
  deploy)
    name="${2:-}"
    pruefe_backupname "$name" || exit 1
    zweig="$(git -C "$hier" branch --show-current)"
    if [ "$zweig" != "$DEPLOY_ZWEIG" ]; then echo "Abbruch: Deploy nur vom Zweig $DEPLOY_ZWEIG, aktuell $zweig" >&2; exit 1; fi
    if [ -n "$(git -C "$hier" status --porcelain)" ]; then echo "Abbruch: ungesicherte Änderungen" >&2; exit 1; fi
    echo "== Aktivität der letzten 30 Minuten (leer = niemand)"
    aktiv
    if [ "${LIVE_JA:-}" != "1" ]; then
      read -r -p "Weiter mit Backup und Deploy? [j/N] " antwort
      [ "$antwort" = "j" ] || exit 1
    fi
    pruefe_termin_dubletten || exit 1
    rsync_pruefen || exit 1
    backup "$name" || { echo "Abbruch: Backup fehlgeschlagen, es wurde nichts verändert" >&2; exit 1; }
    rsync "${RSYNC_OPTIONEN[@]}" "$hier/" "$SSH_HOST:$ZIEL/"
    ssh "$SSH_HOST" "cd $ZIEL && docker compose build app && docker compose up -d"
    echo "== Warte auf den Start"
    for _ in $(seq 1 30); do
      if curl -fsS -o /dev/null "$LIVE_URL/"; then break; fi
      sleep 3
    done
    klicktest
    ;;
  *)
    sed -n '2,/^set -euo/p' "$0" | sed '$d'
    exit 1
    ;;
esac
