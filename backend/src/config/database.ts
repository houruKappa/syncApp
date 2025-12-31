import { Pool } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'syncwatch',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const setupDatabase = async (): Promise<void> => {
  try {
    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    // Create tables if they don't exist
    await createTables();
  } catch (error) {
    logger.error('Database setup error:', error);
    throw error;
  }
};

const createTables = async (): Promise<void> => {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `;

  const createRoomsTable = `
    CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_public BOOLEAN DEFAULT true,
      password VARCHAR(255),
      password_hash VARCHAR(255),
      current_video_url VARCHAR(1000),
      current_video_time FLOAT DEFAULT 0,
      player_state VARCHAR(20) DEFAULT 'paused',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      deleted BOOLEAN DEFAULT false,
      empty_since TIMESTAMP,
      CONSTRAINT fk_creator FOREIGN KEY (creator_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_rooms_creator ON rooms(creator_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_public ON rooms(is_public);
    CREATE INDEX IF NOT EXISTS idx_rooms_deleted ON rooms(deleted) WHERE deleted = true;
    CREATE INDEX IF NOT EXISTS idx_rooms_empty_since ON rooms(empty_since) WHERE empty_since IS NOT NULL;
  `;

  const createRoomUsersTable = `
    CREATE TABLE IF NOT EXISTS room_users (
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_moderator BOOLEAN DEFAULT false,
      PRIMARY KEY (room_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_room_users_room ON room_users(room_id);
    CREATE INDEX IF NOT EXISTS idx_room_users_user ON room_users(user_id);
  `;

  const createMessagesTable = `
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  `;

  const createVideosTable = `
    CREATE TABLE IF NOT EXISTS videos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      original_name VARCHAR(500) NOT NULL,
      stored_name VARCHAR(500) NOT NULL,
      path VARCHAR(1000) NOT NULL,
      size BIGINT NOT NULL,
      duration FLOAT,
      room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
      uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_videos_room ON videos(room_id);
    CREATE INDEX IF NOT EXISTS idx_videos_expires ON videos(expires_at);
  `;

  const createVideoQueueTable = `
    CREATE TABLE IF NOT EXISTS video_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      video_url VARCHAR(1000) NOT NULL,
      video_title VARCHAR(500),
      added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      queue_position INTEGER NOT NULL,
      is_played BOOLEAN DEFAULT false,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_queue_room ON video_queue(room_id);
    CREATE INDEX IF NOT EXISTS idx_queue_position ON video_queue(room_id, queue_position);
  `;

  const createRoomHistoryTable = `
    CREATE TABLE IF NOT EXISTS room_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL,
      room_name VARCHAR(255) NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_moderator BOOLEAN DEFAULT false,
      is_public BOOLEAN DEFAULT true,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_room_history_user ON room_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_room_history_room ON room_history(room_id);
  `;

  const createBannedUsersTable = `
    CREATE TABLE IF NOT EXISTS banned_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      banned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_banned_users_room ON banned_users(room_id);
    CREATE INDEX IF NOT EXISTS idx_banned_users_user ON banned_users(user_id);
  `;

  const createChatMessagesTable = `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username VARCHAR(100) NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
  `;

  try {
    await pool.query(createUsersTable);
    await pool.query(createRoomsTable);
    await pool.query(createRoomUsersTable);
    await pool.query(createMessagesTable);
    await pool.query(createVideosTable);
    await pool.query(createVideoQueueTable);
    await pool.query(createRoomHistoryTable);
    await pool.query(createBannedUsersTable);
    await pool.query(createChatMessagesTable);
    logger.info('Database tables created successfully');
  } catch (error) {
    logger.error('Error creating tables:', error);
    throw error;
  }
};

export { pool };
