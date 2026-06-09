# Color Room - Installation (Docker)

## Prérequis

- Docker installé
- Docker Compose disponible via `docker compose`

## Lancer sur PC (Windows/Linux)

### (Optionnel) Clé IA Gemini

Pour l'assistant IA de l'éditeur, copiez `app/.env.example` en `app/.env` et
renseignez `GEMINI_API_KEY` (clé : https://aistudio.google.com/apikey). Ce
fichier n'est jamais committé. Sans clé, l'app tourne quand même (l'IA renvoie
un message clair) et l'audio + les jeux fonctionnent **hors-ligne**.

Depuis la racine du dépôt:

- `docker compose up -d --build`

Puis ouvrir:

- `http://localhost:8080/`

Vérifier l'état:

- `http://localhost:8080/api/health` (ou la page `/health` pour le diagnostic complet : connexion APIs, test des plaques, contrôle des canaux)

Arrêter:

- `docker compose down`

## Installer en service au démarrage (Raspberry Pi)

Hypothèse: tu veux installer dans `/opt/color-room`.

1. Copier le dépôt sur le Raspberry Pi.
2. Depuis la racine du dépôt, exécuter:

- `sudo bash rpi/install.sh`

Le service systemd s'appelle:

- `color-room.service`

Commandes utiles:

- `sudo systemctl status color-room.service --no-pager`
- `sudo systemctl restart color-room.service`

## Ports

- UI: `8080`

## Notes

- Le `docker-compose.yml` définit un `healthcheck` sur `/api/health`.
- La V1 expose un serveur Next.js.
