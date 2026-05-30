#!/usr/bin/env bash
# Selfy healthcheck — щохвилини пінгує editor-web + Outline + бот.
# Шле Telegram-alert ТІЛЬКИ при зміні стану (UP→DOWN або recovery) — без спаму.
# Без sudo. Запуск під pm2:
#   pm2 start /opt/editor-web/deploy/healthcheck.sh --name selfy-health --interpreter bash
#   pm2 save
# Токен і chat_id читаються з .env бота (нічого приватного в репо).
# Лог: /home/su/selfy-health.log

set -uo pipefail
BOT_ENV=/opt/wiki-selfy-bot/.env
STATE=/home/su/selfy-health.state
LOG=/home/su/selfy-health.log
ts(){ date '+%F %T'; }

tg() { # $1 = text
  local token chat
  token=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$BOT_ENV" 2>/dev/null | cut -d= -f2-)
  chat=$(grep -E '^KNOWLEDGE_GAPS_CHAT_IDS=' "$BOT_ENV" 2>/dev/null | cut -d= -f2- | cut -d, -f1)
  [ -z "$token" ] || [ -z "$chat" ] && return 0
  curl -s -m 10 "https://api.telegram.org/bot${token}/sendMessage" \
    --data-urlencode "chat_id=${chat}" \
    --data-urlencode "text=$1" >/dev/null 2>&1
}

echo "[$(ts)] selfy-health loop started" >>"$LOG"
while true; do
  # editor-web
  if curl -sf -m 8 -o /dev/null http://localhost:3001/api/collections; then ew=UP; else ew=DOWN; fi
  # Outline (homepage; 2xx/3xx = живий)
  code=$(curl -s -m 8 -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo 000)
  if [ "$code" -ge 200 ] && [ "$code" -lt 500 ]; then ol=UP; else ol=DOWN; fi
  # бот (pm2 pid > 0 = online)
  bp=$(pm2 pid wiki-selfy-bot 2>/dev/null | tr -d '[:space:]')
  if [ -n "$bp" ] && [ "$bp" != "0" ]; then bot=UP; else bot=DOWN; fi

  cur="ew=$ew ol=$ol bot=$bot"
  prev=$(cat "$STATE" 2>/dev/null || echo "")

  if [ "$cur" != "$prev" ]; then
    echo "[$(ts)] $prev -> $cur" >>"$LOG"
    if [ "$ew" = UP ] && [ "$ol" = UP ] && [ "$bot" = UP ]; then
      [ -n "$prev" ] && tg "✅ Selfy: усі сервіси відновлено (editor-web, Outline, бот — UP)"
    else
      tg "⚠️ Selfy ALERT: editor-web=$ew, Outline=$ol, бот=$bot ($(ts))"
    fi
    echo "$cur" > "$STATE"
  fi
  sleep 60
done
