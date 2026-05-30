# Авто-деплой (polling watcher)

Сервер 192.168.88.20 за VPN → GitHub не може достукатись webhook'ом.
Тому деплой працює **опитуванням**: раз на ~60с для обох репо `git fetch`;
якщо є нові коміти — `git pull --ff-only`, (для editor-web) `npm install` при
зміні залежностей + `npm run build`, і `pm2 restart`. Якщо build падає —
рестарту НЕ робить (стара версія лишається живою). `git pull --ff-only` ніколи
не затирає локальні зміни (напр. `middleware.ts` видалений для auth-off) — у
гіршому разі просто пропускає тік і пише в лог.

Деплоїть обидва проекти:
- `wiki-selfy-bot` (без build, тільки pm2 restart)
- `editor-web` (npm build + pm2 restart)

## Метод: pm2 demon-цикл (АКТИВНИЙ — без sudo)

На сервері користувач `su` **не має passwordless sudo**, тому systemd timer
недоступний. Натомість вотчер крутиться як pm2-процес (`su` контролює pm2 без
рута, і він уже reboot-safe через `pm2 startup`/`pm2 save`).

`watch-loop.sh` — один довгоживучий процес: тік → `sleep 60` → повтор. pm2 НЕ
вбиває його посеред build (на відміну від `--cron-restart`), тому довгі build
завершуються нормально.

### Налаштування (один раз, SSH Ubuntu, БЕЗ sudo)

```bash
cd /opt/editor-web && git pull --ff-only origin main      # підтягнути скрипти
chmod +x deploy/watch-loop.sh deploy/auto-deploy.sh
pm2 start /opt/editor-web/deploy/watch-loop.sh --name selfy-deploy --interpreter bash
pm2 save                                                   # щоб пережив рестарт
```

### Діагностика

```bash
pm2 status                                  # selfy-deploy має бути online
tail -50 ~/selfy-deploy.log                 # історія деплоїв
pm2 logs selfy-deploy --lines 30 --nostream # вивід циклу
pm2 restart selfy-deploy                    # перезапустити вотчер
pm2 stop selfy-deploy                       # вимкнути авто-деплой
pm2 delete selfy-deploy && pm2 save         # прибрати зовсім
```

## Файли

| Файл | Призначення |
|------|-------------|
| `watch-loop.sh` | pm2 demon-цикл (тік + sleep 60) — **це запускаємо в pm2** |
| `auto-deploy.sh` | один тік деплою (fetch→pull→build→restart). `SELFY_DEPLOY_LOG` env перевизначає лог |
| `selfy-deploy.service` + `.timer` | systemd-альтернатива (потребує sudo — поки НЕ використовується) |

## Альтернатива: systemd timer (якщо колись буде passwordless sudo)

```bash
sudo touch /opt/selfy-deploy.log && sudo chown su:su /opt/selfy-deploy.log
sudo cp deploy/selfy-deploy.service /etc/systemd/system/
sudo cp deploy/selfy-deploy.timer   /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now selfy-deploy.timer
```

## Як це міняє воркфлоу

Раніше: правка → git push (Windows) → ручний SSH: git pull + build + pm2 restart.
Тепер: правка → git push → **сервер сам підхопить за ≤60с**.

> Скрипти лежать у репо editor-web, тож їхні майбутні зміни теж деплояться
> автоматично (після першого ручного `git pull`).
