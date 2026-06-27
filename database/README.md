# База данных SyncWatch

Этот каталог содержит стартовую SQL-схему для проекта. Основной файл инициализации — [init.sql](init.sql).

## Как инициализировать

### Через Docker

Если запускаете проект через `docker-compose.yml`, скрипт `database/init.sql` автоматически подхватится контейнером PostgreSQL при первом старте.

### Через psql

```powershell
psql -U postgres
CREATE DATABASE syncwatch;
\c syncwatch
\i C:/Users/sor6s/Desktop/syncApp/database/init.sql
```

Или из командной строки:

```powershell
psql -U postgres -d syncwatch -f database/init.sql
```

## Что создаёт init.sql

Схема описывает базовые сущности проекта:

- `users` — пользователи
- `rooms` — комнаты просмотра
- `room_users` — участники комнат
- `messages` — сообщения чата
- `videos` — загруженные видео
- `video_queue` — очередь видео

Также создаются:

- расширения `uuid-ossp` и `pgcrypto`;
- триггер для обновления `last_seen`;
- функции очистки истекших комнат и видео;
- представления `room_stats` и `active_users`.

## Важные замечания

- Backend при старте дополнительно создаёт недостающие таблицы и индексы, если схема ещё не полная.
- Для актуального поведения приложения ориентируйтесь на код в [backend/src/config/database.ts](../backend/src/config/database.ts) и [backend/src/server.ts](../backend/src/server.ts).

## Полезные запросы

### Истекшие комнаты

```sql
SELECT cleanup_expired_rooms();
```

### Истекшие видео

```sql
SELECT cleanup_expired_videos();
```

### Статистика комнат

```sql
SELECT * FROM room_stats;
```

### Активные пользователи

```sql
SELECT * FROM active_users;
```
