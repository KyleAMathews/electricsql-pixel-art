-- Enable the UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL UNIQUE,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    pixels_placed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create pixels table
CREATE TABLE pixels (
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (x, y)
);

-- Add electrified composite index for real-time syncing
CREATE INDEX pixels_last_updated_idx ON pixels(last_updated);

-- Add some constraints
ALTER TABLE pixels 
    ADD CONSTRAINT valid_coordinates 
    CHECK (x >= 0 AND x < 1000 AND y >= 0 AND y < 1000);

ALTER TABLE pixels 
    ADD CONSTRAINT valid_color 
    CHECK (color ~ '^#[0-9a-fA-F]{6}$');
