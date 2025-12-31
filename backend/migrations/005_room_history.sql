-- Create room_history table to preserve visit history even after room deletion
CREATE TABLE IF NOT EXISTS room_history (
    id SERIAL PRIMARY KEY,
    room_id UUID NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_moderator BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP
);

CREATE INDEX idx_room_history_user ON room_history(user_id);
CREATE INDEX idx_room_history_joined ON room_history(joined_at DESC);

-- Insert existing room_users into history
INSERT INTO room_history (room_id, room_name, user_id, is_moderator, is_public, joined_at)
SELECT ru.room_id, r.name, ru.user_id, ru.is_moderator, r.is_public, ru.joined_at
FROM room_users ru
INNER JOIN rooms r ON ru.room_id = r.id
ON CONFLICT DO NOTHING;
