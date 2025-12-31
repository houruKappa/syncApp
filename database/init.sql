-- SyncWatch Database Schema
-- Инициализация базы данных

-- Создание расширения для UUID (если не установлено)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Удаление существующих таблиц (опционально, раскомментируйте при необходимости)
-- DROP TABLE IF EXISTS video_queue CASCADE;
-- DROP TABLE IF EXISTS videos CASCADE;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS room_users CASCADE;
-- DROP TABLE IF EXISTS rooms CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для таблицы users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Таблица комнат
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    creator_id UUID NOT NULL,
    is_public BOOLEAN DEFAULT true,
    password_hash VARCHAR(255),
    current_video_url VARCHAR(1000),
    current_video_time FLOAT DEFAULT 0,
    player_state VARCHAR(20) DEFAULT 'paused',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    CONSTRAINT fk_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Индексы для таблицы rooms
CREATE INDEX IF NOT EXISTS idx_rooms_creator ON rooms(creator_id);
CREATE INDEX IF NOT EXISTS idx_rooms_public ON rooms(is_public);
CREATE INDEX IF NOT EXISTS idx_rooms_expires ON rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);

-- Таблица участников комнат
CREATE TABLE IF NOT EXISTS room_users (
    room_id UUID NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_moderator BOOLEAN DEFAULT false,
    PRIMARY KEY (room_id, user_id),
    CONSTRAINT fk_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Индексы для таблицы room_users
CREATE INDEX IF NOT EXISTS idx_room_users_room ON room_users(room_id);
CREATE INDEX IF NOT EXISTS idx_room_users_user ON room_users(user_id);
CREATE INDEX IF NOT EXISTS idx_room_users_moderator ON room_users(is_moderator);

-- Таблица сообщений чата
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    user_id UUID NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_message_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Индексы для таблицы messages
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);

-- Таблица загруженных видео
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_name VARCHAR(500) NOT NULL,
    stored_name VARCHAR(500) NOT NULL,
    path VARCHAR(1000) NOT NULL,
    size BIGINT NOT NULL,
    duration FLOAT,
    room_id UUID,
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_video_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_video_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Индексы для таблицы videos
CREATE INDEX IF NOT EXISTS idx_videos_room ON videos(room_id);
CREATE INDEX IF NOT EXISTS idx_videos_uploader ON videos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_videos_expires ON videos(expires_at);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded_at ON videos(uploaded_at);

-- Таблица очереди видео
CREATE TABLE IF NOT EXISTS video_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    video_url VARCHAR(1000) NOT NULL,
    video_title VARCHAR(500),
    added_by UUID NOT NULL,
    queue_position INTEGER NOT NULL,
    is_played BOOLEAN DEFAULT false,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_queue_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_queue_user FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Индексы для таблицы video_queue
CREATE INDEX IF NOT EXISTS idx_queue_room ON video_queue(room_id);
CREATE INDEX IF NOT EXISTS idx_queue_position ON video_queue(room_id, queue_position);
CREATE INDEX IF NOT EXISTS idx_queue_played ON video_queue(room_id, is_played);
CREATE INDEX IF NOT EXISTS idx_queue_added_by ON video_queue(added_by);

-- Функция для автоматического обновления last_seen при активности пользователя
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления last_seen при отправке сообщения
CREATE TRIGGER trigger_update_last_seen_on_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_last_seen();

-- Функция для автоматической очистки истекших комнат
CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM rooms WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматической очистки истекших видео
CREATE OR REPLACE FUNCTION cleanup_expired_videos()
RETURNS void AS $$
BEGIN
    DELETE FROM videos WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Создание представления для статистики комнат
CREATE OR REPLACE VIEW room_stats AS
SELECT 
    r.id,
    r.name,
    r.creator_id,
    u.username as creator_name,
    r.is_public,
    r.created_at,
    COUNT(DISTINCT ru.user_id) as user_count,
    COUNT(DISTINCT m.id) as message_count,
    COUNT(DISTINCT vq.id) as queue_count
FROM rooms r
LEFT JOIN users u ON r.creator_id = u.id
LEFT JOIN room_users ru ON r.id = ru.room_id
LEFT JOIN messages m ON r.id = m.room_id
LEFT JOIN video_queue vq ON r.id = vq.room_id AND vq.is_played = false
WHERE r.expires_at > CURRENT_TIMESTAMP
GROUP BY r.id, r.name, r.creator_id, u.username, r.is_public, r.created_at;

-- Создание представления для активных пользователей
CREATE OR REPLACE VIEW active_users AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.avatar_url,
    u.last_seen,
    COUNT(DISTINCT ru.room_id) as rooms_joined,
    COUNT(DISTINCT m.id) as messages_sent
FROM users u
LEFT JOIN room_users ru ON u.id = ru.user_id
LEFT JOIN messages m ON u.id = m.user_id
WHERE u.last_seen > CURRENT_TIMESTAMP - INTERVAL '1 day'
GROUP BY u.id, u.username, u.email, u.avatar_url, u.last_seen;

-- Вставка тестовых данных (опционально, раскомментируйте при необходимости)
-- INSERT INTO users (email, username, password_hash) VALUES
-- ('admin@syncwatch.com', 'Admin', '$2b$10$XYZ...'), -- замените на реальный хеш пароля
-- ('user1@syncwatch.com', 'User One', '$2b$10$ABC...'),
-- ('user2@syncwatch.com', 'User Two', '$2b$10$DEF...');

-- Вывод информации о созданных таблицах
DO $$
BEGIN
    RAISE NOTICE 'База данных SyncWatch успешно инициализирована!';
    RAISE NOTICE 'Созданные таблицы:';
    RAISE NOTICE '  - users (пользователи)';
    RAISE NOTICE '  - rooms (комнаты)';
    RAISE NOTICE '  - room_users (участники комнат)';
    RAISE NOTICE '  - messages (сообщения)';
    RAISE NOTICE '  - videos (видео)';
    RAISE NOTICE '  - video_queue (очередь видео)';
    RAISE NOTICE 'Созданные представления:';
    RAISE NOTICE '  - room_stats (статистика комнат)';
    RAISE NOTICE '  - active_users (активные пользователи)';
END $$;
