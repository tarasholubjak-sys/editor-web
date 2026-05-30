# Авто-деплой (polling watcher)

Сервер 192.168.88.20 за VPN → GitHub не може достукатись webhook'ом.
Тому деплой працює **опитуванням**: systemd timer раз на 60с запускає
`auto-deploy.sh`, який для обох репо робить `git fetch`; якщо є нові коміти —
`git pull --ff-only`, (для editor-web) `npm install` при зміні залежностей +
`npm run build`, і `pm2 restart`. Якщо build падає — рестарту НЕ робить
(стара версія лишається живою).

Деплоїть обидва проекти:
- `wiki-selfy-bot` (без build, тільки pm2 restart)
- `editor-web` (npm build + pm2 restart)

## Файли

| Файл | Призначення | Куди на сервері |
|------|-------------|-----------------|
| `auto-deploy.sh` | сам скрипт деплою | `/opt/editor-web/deploy/auto-deploy.sh` (з git pull) |
| `selfy-deploy.service` | systemd oneshot | `/etc/systemd/system/selfy-deploy.service` |
| `selfy-deploy.timer` | systemd timer (60с) | `/etc/systemd/system/selfy-deploy.timer` |

## Налаштування (один раз, SSH Ubuntu)

```bash
# 1. підтягнути скрипт у репо editor-web на сервері
cd /opt/editor-web && git pull --ff-only origin main

# 2. лог-файл (writable для su)
sudo touch /opt/selfy-deploy.log && sudo chown su:su /opt/selfy-deploy.log
sudo chmod +x /opt/editor-web/deploy/auto-deploy.sh

# 3. скопіювати unit-файли з репо в systemd
sudo cp /opt/editor-web/deploy/selfy-deploy.service /etc/systemd/system/
sudo cp /opt/editor-web/deploy/selfy-deploy.timer   /etc/systemd/system/

# 4. увімкнути таймер (reboot-safe)
sudo systemctl daemon-reload
sudo systemctl enable --now selfy-deploy.timer

# 5. перевірка
systemctl list-timers selfy-deploy.timer   # має бути в розкладі
sudo systemctl start selfy-deploy.service   # запустити один тік зараз
tail -f /opt/selfy-deploy.log               # дивитись як працює
```

## Діагностика

```bash
tail -50 /opt/selfy-deploy.log              # історія деплоїв
systemctl status selfy-deploy.timer         # стан таймера
sudo systemctl start selfy-deploy.service   # форсувати деплой зараз
sudo systemctl disable --now selfy-deploy.timer  # вимкнути авто-деплой
```

## Як це міняє воркфлоу

Раніше: правка → git push (Windows) → ручний SSH: git pull + build + pm2 restart.
Тепер: правка → git push (Windows) → **сервер сам підхопить за ≤60с**.

> Скрипт лежить у репо editor-web, тож майбутні його зміни теж деплояться
> автоматично (після першого ручного `git pull` на кроці 1).
