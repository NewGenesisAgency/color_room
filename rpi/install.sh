set -e

APP_DIR=/opt/color-room

mkdir -p "$APP_DIR"

cp -r ./docker_javascript "$APP_DIR/docker_javascript"

cp "$APP_DIR/docker_javascript/rpi/color-room.service" /etc/systemd/system/color-room.service

systemctl daemon-reload
systemctl enable color-room.service
systemctl restart color-room.service

systemctl status color-room.service --no-pager
