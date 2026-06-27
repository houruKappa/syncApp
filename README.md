# SyncWatch

SyncWatch — платформа для синхронизированного совместного просмотра видео с комнатами, чатом, очередью роликов, авторизацией, профилем пользователя и WebSocket-синхронизацией плеера.

## Возможности

- Регистрация, вход, обновление access token и выход.
- Публичные и приватные комнаты с паролем.
- Совместный просмотр видео с синхронизацией play/pause/seek.
- Очередь видео в комнате и автоматический переход к следующему ролику.
- Чат внутри комнаты и история активности пользователя.
- Загрузка видео и аватаров.
- Модерация комнаты: передача прав, кик пользователей, удаление комнаты.
- Автоматическая очистка удалённых и пустых комнат, а также файлов видео.

## Технологии

- Backend: Node.js, Express, TypeScript, Socket.io, PostgreSQL, Redis
- Frontend: React, TypeScript, Redux Toolkit, React Router, Material UI, video.js
- Инфраструктура: Docker, Docker Compose, nginx

## Архитектура

- [backend/src/server.ts](backend/src/server.ts) поднимает Express API, Socket.io, подключение к PostgreSQL и Redis.
- [backend/src/routes](backend/src/routes) содержит REST API для auth, rooms, user и videos.
- [backend/src/socket/index.ts](backend/src/socket/index.ts) обрабатывает realtime-события комнаты и синхронизацию плеера.
- [frontend/src/App.tsx](frontend/src/App.tsx) определяет маршруты приложения.
- [frontend/src/services/api.ts](frontend/src/services/api.ts) и [frontend/src/services/socket.ts](frontend/src/services/socket.ts) управляют HTTP и WebSocket-клиентом.

## Структура проекта

```text
syncApp/
├── backend/         # API, socket-сервер, загрузки, миграции и логи
├── database/        # SQL-инициализация и документация по схеме
├── frontend/        # React SPA
└── docker-compose.yml
```

## Требования

- Node.js 18+.
- PostgreSQL 14+.
- Redis 7+.
- Docker и Docker Compose, если нужен запуск через контейнеры.

## Быстрый старт через Docker

1. Проверьте, что Docker Desktop запущен.
2. В корне проекта выполните:

```powershell
docker-compose up -d --build
```

3. Откройте:
- Frontend: http://localhost:3000
- Backend healthcheck: http://localhost:5000/health

### Что поднимется

- PostgreSQL на `5432`.
- Redis на `6379`.
- Backend на `5000`.
- Frontend на `3000`.

## Локальный запуск без Docker

### 1. База данных и Redis

Запустите PostgreSQL и Redis любым удобным способом и создайте базу.

### 2. Backend

```powershell
cd backend
npm install
npm run dev
```

### 3. Frontend

```powershell
cd frontend
npm install
npm start
```

## Переменные окружения

### Backend

Основные переменные, которые используются кодом и Docker Compose:

| Переменная | Назначение | Пример |
| --- | --- | --- |
| `PORT` | Порт API | `5000` |
| `NODE_ENV` | Режим работы | `development` / `production` |
| `CORS_ORIGIN` | Разрешённый origin фронтенда | `http://localhost:3000` |
| `DB_HOST` | Хост PostgreSQL | `localhost` |
| `DB_PORT` | Порт PostgreSQL | `5432` |
| `DB_NAME` | Имя базы | `syncwatch` |
| `DB_USER` | Пользователь БД | `postgres` |
| `DB_PASSWORD` | Пароль БД | `postgres` |
| `REDIS_HOST` | Хост Redis | `localhost` |
| `REDIS_PORT` | Порт Redis | `6379` |
| `REDIS_PASSWORD` | Пароль Redis, если нужен | пусто |
| `JWT_SECRET` | Секрет access token | любой надёжный секрет |
| `JWT_EXPIRES_IN` | Срок жизни access token | `7d` |
| `JWT_REFRESH_SECRET` | Секрет refresh token | любой надёжный секрет |
| `JWT_REFRESH_EXPIRES_IN` | Срок жизни refresh token | `30d` |
| `RATE_LIMIT_WINDOW_MS` | Окно rate limit | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Максимум запросов за окно | `100` |
| `MAX_FILE_SIZE` | Максимальный размер видео | `209715200` |

### Frontend

| Переменная | Назначение | Пример |
| --- | --- | --- |
| `REACT_APP_API_URL` | Базовый URL backend API | `http://localhost:5000` |
| `REACT_APP_WS_URL` | Базовый URL Socket.io | `http://localhost:5000` |

## Основные API-эндпоинты

### Healthcheck

- `GET /health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

### Rooms

- `POST /api/rooms`
- `GET /api/rooms`
- `GET /api/rooms/:id`
- `POST /api/rooms/:id/join`
- `DELETE /api/rooms/:id`
- `POST /api/rooms/:id/transfer-moderator`
- `DELETE /api/rooms/:id/users/:userId`

### User

- `GET /api/user/profile`
- `PUT /api/user/profile`
- `POST /api/user/avatar`
- `GET /api/user/history`
- `DELETE /api/user/history`

### Videos

- `POST /api/videos/upload`
- `GET /api/videos/:id`
- `DELETE /api/videos/:id`

## Realtime-события Socket.io

### Подключение

Клиент передаёт JWT в `socket.handshake.auth.token`.

### События клиента

- `join-room`
- `leave-room`
- `player-action`
- `chat-message`
- `add-to-queue`
- `skip-video`
- `play-next`
- `remove-from-queue`
- `kick-user`
- `delete-room`
- `reorder-queue`

### События сервера

- `room-state`
- `queue-updated`
- `user-joined`
- `user-left`
- `player-sync`
- `new-message`
- `system-message`
- `video-changed`
- `room-closed`
- `error`

## Работа с видео

- Видео и аватары хранятся в `backend/uploads`.
- Для загрузки видео используется `multipart/form-data`.
- Разрешённые форматы видео: `mp4`, `webm`, `ogg`.
- Разрешённые форматы аватаров: `jpeg`, `jpg`, `png`, `gif`.
- Сервис автоматически удаляет файлы видео при очистке комнат или удалении ролика.

## База данных

- Стартовая схема лежит в [database/init.sql](database/init.sql).
- Краткая документация по схеме и инициализации находится в [database/README.md](database/README.md).
- Backend также создаёт недостающие таблицы и индексы при старте, если схема ещё не готова.

## Логика очистки

Backend раз в минуту выполняет очистку:

- удаляет комнаты, помеченные как удалённые модератором;
- удаляет пустые комнаты, если они пустуют более 5 минут;
- удаляет связанные видеофайлы из `uploads/videos`;
- отправляет событие `room-closed` оставшимся клиентам.

## Полезные команды

### Backend

```powershell
cd backend
npm run dev
npm run build
npm start
npm run lint
```

### Frontend

```powershell
cd frontend
npm start
npm run build
npm run lint
```

## Примечания

- Пароли комнат и пользователей хранятся в виде хешей.
- Доступ к большинству API требует JWT в заголовке `Authorization: Bearer <token>`.
- Публичные комнаты можно получить без перехода в приватную комнату, но сам вход в комнату всё равно проходит через авторизацию.
