# Схема базы данных

## Таблицы

### users
- `id` UUID PRIMARY KEY
- `email` VARCHAR(255) UNIQUE NOT NULL
- `username` VARCHAR(100) NOT NULL
- `password_hash` VARCHAR(255) NOT NULL
- `avatar_url` VARCHAR(500)
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `last_seen` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### rooms
- `id` UUID PRIMARY KEY
- `name` VARCHAR(255) NOT NULL
- `creator_id` UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `is_public` BOOLEAN DEFAULT true
- `password` VARCHAR(255) - для хранения пароля комнаты
- `password_hash` VARCHAR(255) - хеш пароля для проверки
- `current_video_url` VARCHAR(1000)
- `current_video_time` FLOAT DEFAULT 0
- `player_state` VARCHAR(20) DEFAULT 'paused'
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `expires_at` TIMESTAMP
- **`deleted` BOOLEAN DEFAULT false** - мягкое удаление модератором
- **`empty_since` TIMESTAMP** - время когда все пользователи вышли из комнаты

**Индексы:**
- `idx_rooms_deleted` - для поиска удаленных комнат
- `idx_rooms_empty_since` - для поиска пустых комнат

### room_users
- `room_id` UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
- `user_id` UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- **`is_moderator` BOOLEAN DEFAULT false** - статус модератора
- PRIMARY KEY (room_id, user_id)

### room_history
История посещений комнат пользователями (не удаляется при выходе из комнаты)
- `id` UUID PRIMARY KEY
- `room_id` UUID NOT NULL
- `room_name` VARCHAR(255) NOT NULL
- `user_id` UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- **`is_moderator` BOOLEAN DEFAULT false** - был ли модератором
- `is_public` BOOLEAN DEFAULT true
- `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### banned_users
Список забаненных пользователей в комнатах
- `id` UUID PRIMARY KEY
- `room_id` UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
- `user_id` UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `banned_by` UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `banned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- UNIQUE(room_id, user_id)

### chat_messages
Сообщения чата в комнатах
- `id` UUID PRIMARY KEY
- `room_id` UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
- `user_id` UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `username` VARCHAR(100) NOT NULL
- `text` TEXT NOT NULL
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### video_queue
Очередь видео в комнате
- `id` UUID PRIMARY KEY
- `room_id` UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
- `video_url` VARCHAR(1000) NOT NULL
- `video_title` VARCHAR(500)
- `added_by` UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `queue_position` INTEGER NOT NULL
- `is_played` BOOLEAN DEFAULT false
- `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### messages
Системные сообщения (legacy)
- `id` UUID PRIMARY KEY
- `room_id` UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
- `user_id` UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `text` TEXT NOT NULL
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### videos
Загруженные видео файлы
- `id` UUID PRIMARY KEY
- `original_name` VARCHAR(500) NOT NULL
- `stored_name` VARCHAR(500) NOT NULL
- `path` VARCHAR(1000) NOT NULL
- `size` BIGINT NOT NULL
- `duration` FLOAT
- `room_id` UUID REFERENCES rooms(id) ON DELETE CASCADE
- `uploaded_by` UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `expires_at` TIMESTAMP NOT NULL

## Восстановленные функции

### 1. Система мягкого удаления комнат
- **Поля:** `deleted` и `empty_since` в таблице `rooms`
- **Логика:**
  - Модератор удаляет комнату → `deleted = true`, `empty_since = CURRENT_TIMESTAMP`
  - Cleanup task каждую минуту находит комнаты с `deleted = true` и удаляет их навсегда

### 2. Автоматическое удаление пустых комнат
- **Поле:** `empty_since` в таблице `rooms`
- **Логика:**
  - Когда все пользователи выходят из комнаты → `empty_since = CURRENT_TIMESTAMP`
  - Cleanup task каждую минуту находит комнаты с `empty_since < NOW() - 5 minutes` и удаляет их

### 3. Система модераторов
- **Поле:** `is_moderator` в таблице `room_users`
- **Логика:**
  - Создатель комнаты (`creator_id`) всегда становится модератором при входе
  - При выходе модератора из комнаты, статус сохраняется в `room_history`
  - При повторном входе создателя, статус модератора восстанавливается автоматически

### 4. История посещений комнат
- **Таблица:** `room_history`
- **Логика:**
  - При входе в комнату добавляется запись с `is_moderator` и `room_name`
  - Используется для:
    - Отображения истории посещений на странице профиля
    - Проверки прав модератора после выхода из комнаты
    - Возможности удалить комнату даже после выхода из нее

### 5. Система банов
- **Таблица:** `banned_users`
- **Логика:**
  - Модератор может забанить пользователя
  - Забаненный пользователь не может войти в комнату
  - Проверка при попытке входа через `join-room` socket event

### 6. Инвайт ссылки с паролем
- **Поля:** `password` и `password_hash` в таблице `rooms`
- **Логика:**
  - При создании приватной комнаты устанавливается пароль
  - При попытке входа через инвайт ссылку запрашивается пароль
  - Проверка пароля через bcrypt

## Cleanup Task

Задача очистки запускается каждую минуту и выполняет:

1. **Удаление помеченных комнат** (`deleted = true`)
   - Удаляет видео файлы
   - Уведомляет пользователей через socket `room-closed`
   - Удаляет комнату из БД

2. **Удаление пустых комнат** (`empty_since < NOW() - 5 minutes`)
   - Удаляет видео файлы
   - Удаляет комнату из БД

## Важные заметки

- При `docker-compose down -v` все данные БД удаляются
- При пересоздании контейнеров схема создается из `backend/src/config/database.ts`
- Все таблицы и индексы создаются автоматически при первом запуске
- Для ручной проверки БД: `docker-compose exec postgres psql -U postgres -d syncAppBase`
