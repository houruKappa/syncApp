-- Create banned_users table
CREATE TABLE IF NOT EXISTS banned_users (
    id SERIAL PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    UNIQUE(room_id, user_id)
);

CREATE INDEX idx_banned_users_room ON banned_users(room_id);
CREATE INDEX idx_banned_users_user ON banned_users(user_id);
