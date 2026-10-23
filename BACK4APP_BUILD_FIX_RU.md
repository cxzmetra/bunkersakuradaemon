# Исправление ошибки сборки Back4App

Ошибка `COPY failed: no source files specified` возникает, когда Docker не находит `multiplayer_server/package*.json` в контексте сборки.

## Важно: настрой корневую папку сборки

В настройках контейнера Back4App укажи **Build Context / Root Directory** как папку, где непосредственно лежат `Dockerfile` и `multiplayer_server/`.

Если в GitHub репозитории файлы находятся внутри папки `Bunker_Sakuradaemon_Beta15_FullContent/`, установи эту папку как Build Context. В ней должны быть:
- `Dockerfile`
- `multiplayer_server/package.json`
- `multiplayer_server/server.js`

Если Back4App собирает из корня репозитория, а проект вложен в папку, Dockerfile не увидит путь `multiplayer_server/...` — это и вызывает ошибку.

После исправления Build Context запусти Redeploy.

Если интерфейс Back4App не позволяет задать Build Context, альтернативно перенеси содержимое папки `Bunker_Sakuradaemon_Beta15_FullContent/` в корень GitHub-репозитория, чтобы `Dockerfile` и `multiplayer_server/` находились рядом в корне.

Успешная сборка ещё не подтверждает сетевую работу игры. После деплоя проверь логи запуска и публичный адрес сервиса.
