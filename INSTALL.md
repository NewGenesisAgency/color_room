# Color Room - Installation (Docker)

## Prérequis

- Docker installé
- Docker Compose disponible via `docker compose`

## Lancer sur PC (Windows/Linux)

Depuis la racine du dépôt:

- `docker compose -f docker_javascript/docker-compose.yml up -d --build`

Puis ouvrir:

- `http://localhost:8080/`

Vérifier l'état:

- `http://localhost:8080/api/health`

Arrêter:

- `docker compose -f docker_javascript/docker-compose.yml down`

## Installer en service au démarrage (Raspberry Pi)

Hypothèse: tu veux installer dans `/opt/color-room`.

1. Copier le dépôt sur le Raspberry Pi.
2. Depuis la racine du dépôt, exécuter:

- `sudo bash docker_javascript/rpi/install.sh`

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
