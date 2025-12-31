-- Add moderator_left_at field to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS moderator_left_at TIMESTAMP;
