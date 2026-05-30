#!/usr/bin/env bash
# Demon-цикл для pm2 (варіант БЕЗ sudo — на сервері su не має passwordless sudo,
# тому systemd timer недоступний; pm2 же su контролює напряму і він reboot-safe).
#
# Один довгоживучий процес: тік деплою → sleep 60 → повтор. pm2 НЕ вбиває його
# посеред build (на відміну від cron-restart), тому довгі build editor-web (1-3хв)
# завершуються нормально.
#
# Запуск (один раз, на сервері, без sudo):
#   pm2 start /opt/editor-web/deploy/watch-loop.sh --name selfy-deploy --interpreter bash
#   pm2 save
#
# Лог: /home/su/selfy-deploy.log (su-writable; /opt належить root) + pm2 logs selfy-deploy

export SELFY_DEPLOY_LOG="${SELFY_DEPLOY_LOG:-$HOME/selfy-deploy.log}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[$(date '+%F %T')] selfy-deploy loop started (log: $SELFY_DEPLOY_LOG)"
while true; do
  bash "$SCRIPT_DIR/auto-deploy.sh"
  sleep 60
done
