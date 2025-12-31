-- Add deleted flag and empty_since timer to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS empty_since TIMESTAMP;

-- Create index for efficient query of empty rooms
CREATE INDEX IF NOT EXISTS idx_rooms_empty_since ON rooms(empty_since) WHERE empty_since IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_deleted ON rooms(deleted) WHERE deleted = true;
