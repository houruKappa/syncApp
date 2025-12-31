# База данных SyncWatch

## Инициализация БД

### Способ 1: Автоматически (при запуске backend)

Backend автоматически создаст все таблицы при первом запуске.

### Способ 2: Вручную через psql

```powershell
# Подключитесь к PostgreSQL
psql -U postgres

# Создайте базу данных
CREATE DATABASE syncwatch;

# Подключитесь к ней
\c syncwatch

# Выполните скрипт инициализации
\i C:/Users/sor6s/Desktop/syncApp/database/init.sql

# Или напрямую из командной строки:
psql -U postgres -d syncwatch -f database/init.sql
```

### Способ 3: Через Docker

```powershell
# Если БД в Docker контейнере
docker-compose exec postgres psql -U postgres -d syncwatch -f /docker-entrypoint-initdb.d/init.sql

# Или скопируйте скрипт в контейнер и выполните
docker cp database/init.sql syncwatch-postgres:/tmp/init.sql
docker-compose exec postgres psql -U postgres -d syncwatch -f /tmp/init.sql
```

## Структура таблиц

### users (Пользователи)
- `id` - UUID, первичный ключ
- `email` - Email пользователя (уникальный)
- `username` - Имя пользователя
- `password_hash` - Хеш пароля
- `avatar_url` - URL аватара
- `created_at` - Дата создания
- `last_seen` - Последняя активность

### rooms (Комнаты)
- `id` - UUID, первичный ключ
- `name` - Название комнаты
- `creator_id` - ID создателя (FK → users)
- `is_public` - Публичная/приватная
- `password_hash` - Хеш пароля (для приватных)
- `current_video_url` - Текущее видео
- `current_video_time` - Позиция воспроизведения
- `player_state` - Состояние плеера
- `created_at` - Дата создания
- `expires_at` - Дата истечения (24 часа)

### room_users (Участники комнат)
- `room_id` - ID комнаты (FK → rooms)
- `user_id` - ID пользователя (FK → users)
- `joined_at` - Время присоединения
- `is_moderator` - Является ли модератором

### messages (Сообщения)
- `id` - UUID, первичный ключ
- `room_id` - ID комнаты (FK → rooms)
- `user_id` - ID отправителя (FK → users)
- `text` - Текст сообщения
- `created_at` - Время отправки

### videos (Загруженные видео)
- `id` - UUID, первичный ключ
- `original_name` - Оригинальное имя файла
- `stored_name` - Имя на сервере
- `path` - Путь к файлу
- `size` - Размер в байтах
- `duration` - Длительность
- `room_id` - ID комнаты (FK → rooms)
- `uploaded_by` - ID загрузившего (FK → users)
- `uploaded_at` - Время загрузки
- `expires_at` - Время истечения (24 часа)

### video_queue (Очередь видео)
- `id` - UUID, первичный ключ
- `room_id` - ID комнаты (FK → rooms)
- `video_url` - URL видео
- `video_title` - Название видео
- `added_by` - ID добавившего (FK → users)
- `queue_position` - Позиция в очереди
- `is_played` - Было ли воспроизведено
- `added_at` - Время добавления

## Представления (Views)

### room_stats
Статистика по комнатам:
- Количество участников
- Количество сообщений
- Количество видео в очереди

```sql
SELECT * FROM room_stats;
```

### active_users
Активные пользователи (за последние 24 часа):
- Количество посещенных комнат
- Количество отправленных сообщений

```sql
SELECT * FROM active_users;
```

## Полезные запросы

### Получить все комнаты пользователя
```sql
SELECT r.* 
FROM rooms r
INNER JOIN room_users ru ON r.id = ru.room_id
WHERE ru.user_id = 'USER_UUID';
```

### Получить историю чата комнаты
```sql
SELECT m.*, u.username, u.avatar_url
FROM messages m
INNER JOIN users u ON m.user_id = u.id
WHERE m.room_id = 'ROOM_UUID'
ORDER BY m.created_at DESC
LIMIT 50;
```

### Получить очередь видео
```sql
SELECT * FROM video_queue
WHERE room_id = 'ROOM_UUID' AND is_played = false
ORDER BY queue_position ASC;
```

### Очистить истекшие комнаты
```sql
SELECT cleanup_expired_rooms();
```

### Очистить истекшие видео
```sql
SELECT cleanup_expired_videos();
```

## Обслуживание БД

### Резервное копирование
```powershell
# Создать backup
pg_dump -U postgres syncwatch > backup.sql

# Или с Docker
docker-compose exec postgres pg_dump -U postgres syncwatch > backup.sql
```

### Восстановление
```powershell
# Восстановить из backup
psql -U postgres syncwatch < backup.sql

# Или с Docker
docker-compose exec -T postgres psql -U postgres syncwatch < backup.sql
```

### Очистка данных
```sql
-- Удалить все данные (осторожно!)
TRUNCATE TABLE video_queue, messages, room_users, videos, rooms, users CASCADE;

-- Удалить истекшие данные
SELECT cleanup_expired_rooms();
SELECT cleanup_expired_videos();
```

## Индексы

Все необходимые индексы уже созданы для оптимизации запросов:
- Индексы на email пользователей
- Индексы на связи между таблицами (FK)
- Индексы на временные метки
- Составные индексы для сложных запросов

## Мониторинг

### Размер таблиц
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Количество записей
```sql
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL
SELECT 'room_users', COUNT(*) FROM room_users
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'videos', COUNT(*) FROM videos
UNION ALL
SELECT 'video_queue', COUNT(*) FROM video_queue;
```
