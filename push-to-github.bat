@echo off
echo === PUSH editor-web до GitHub ===
echo.
cd /d C:\selfy-outline-mcp\editor-web
echo Папка: %CD%
echo.
echo === Налаштовую remote URL ===
git remote set-url origin https://github.com/tarasholubjak-sys/editor-web.git
echo OK
echo.
echo === Push на GitHub ===
echo (Якщо запитає логін - введи GitHub username і Personal Access Token)
echo.
git push -u origin main
echo.
echo === Готово ===
pause
