#!/usr/bin/env bash
# Selfy auto-deploy watcher
# Опитує GitHub раз на хвилину (через systemd timer). Якщо є нові коміти —
# git pull --ff-only, (для editor-web) npm install при зміні залежностей + build,
# і pm2 restart. Якщо build падає — НЕ рестартує (стара версія лишається живою).
#
# Лог: /opt/selfy-deploy.log
# Запускається через: selfy-deploy.timer (кожні 60с)

set -uo pipefail

# Не дозволяємо двом запускам перетинатись (build editor-web може тривати >60с)
exec 9>/tmp/selfy-deploy.lock
flock -n 9 || exit 0

LOG="${SELFY_DEPLOY_LOG:-/opt/selfy-deploy.log}"
# Обрізаємо лог якщо переріс ~10MB (накопичення build-виводу за місяці)
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 10000000 ] && : >"$LOG"
log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

deploy() {
  local dir="$1" name="$2" mode="$3"
  cd "$dir" 2>/dev/null || { log "$name: папка $dir відсутня — пропуск"; return; }

  if ! git fetch origin main --quiet 2>>"$LOG"; then
    log "$name: git fetch впав — пропуск"
    return
  fi

  local local_sha remote_sha
  local_sha=$(git rev-parse HEAD)
  remote_sha=$(git rev-parse origin/main)
  [ "$local_sha" = "$remote_sha" ] && return  # вже актуально → тихо виходимо

  log "$name: нові коміти ${local_sha:0:7} → ${remote_sha:0:7}, деплою"

  # Чи змінились залежності (щоб не робити npm install щоразу)
  local deps_changed=0
  if git diff --name-only HEAD origin/main | grep -qE 'package(-lock)?\.json$'; then
    deps_changed=1
  fi

  if ! git pull --ff-only origin main >>"$LOG" 2>&1; then
    log "$name: git pull --ff-only ВПАВ (історія розійшлась?) — НЕ деплою, потрібне ручне втручання"
    return
  fi

  if [ "$mode" = "build" ]; then
    if [ "$deps_changed" = "1" ]; then
      log "$name: змінились залежності → npm ci (не змінює lock, відтворювано)"
      if ! timeout 300 npm ci --no-audit --no-fund >>"$LOG" 2>&1; then
        log "$name: npm ci ВПАВ — НЕ рестартую"
        return
      fi
    fi
    log "$name: build"
    if ! timeout 600 env NODE_OPTIONS='--max-old-space-size=4096' npm run build >>"$LOG" 2>&1; then
      log "$name: BUILD ВПАВ/таймаут — стара версія лишається живою, рестарту НЕ роблю"
      return
    fi
  fi

  if pm2 restart "$name" --update-env >>"$LOG" 2>&1; then
    log "$name: ✅ задеплоєно та перезапущено"
  else
    log "$name: pm2 restart впав — перевір 'pm2 status'"
  fi
}

log "──── watcher tick ────"
deploy /opt/wiki-selfy-bot wiki-selfy-bot nobuild
deploy /opt/editor-web     editor-web     build
