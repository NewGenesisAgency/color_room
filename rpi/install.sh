#!/usr/bin/env bash
# Installe Color Room en service systemd sur le Raspberry Pi.
# Lance docker compose DIRECTEMENT depuis le dépôt cloné (pas de copie) :
# ainsi le fichier app/.env (clé Gemini / réglages Ollama) est conservé.
set -e

# Racine du dépôt = dossier parent de ce script (rpi/..)
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Dépôt détecté : $REPO_DIR"
if [ ! -f "$REPO_DIR/docker-compose.yml" ]; then
  echo "Erreur : docker-compose.yml introuvable dans $REPO_DIR" >&2
  exit 1
fi

# Génère l'unité systemd avec le bon WorkingDirectory
sed "s|__WORKDIR__|$REPO_DIR|g" "$REPO_DIR/rpi/color-room.service" > /etc/systemd/system/color-room.service

systemctl daemon-reload
systemctl enable color-room.service
systemctl restart color-room.service
systemctl status color-room.service --no-pager
