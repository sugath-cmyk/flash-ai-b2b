-- Migration: Phase 2 Features
-- Created: 2024-12-24
-- Description: Adds team_members table and updates documents table for Phase 2 features

-- Team Members Table (for RBAC)
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

-- Add original_name column to documents (alias for original_filename)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='documents' AND column_name='original_name') THEN
        ALTER TABLE documents ADD COLUMN original_name VARCHAR(255);
        -- Copy data from original_filename if it exists
        UPDATE documents SET original_name = original_filename WHERE original_filename IS NOT NULL;
    END IF;
END $$;

-- Add file_path column to documents (alias for storage_path)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='documents' AND column_name='file_path') THEN
        ALTER TABLE documents ADD COLUMN file_path TEXT;
        -- Copy data from storage_path if it exists
        UPDATE documents SET file_path = storage_path WHERE storage_path IS NOT NULL;
    END IF;
END $$;

-- Add size column to documents (alias for file_size)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='documents' AND column_name='size') THEN
        ALTER TABLE documents ADD COLUMN size BIGINT;
        -- Copy data from file_size if it exists
        UPDATE documents SET size = file_size WHERE file_size IS NOT NULL;
    END IF;
END $$;

-- Add analyzed_at column to documents
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='documents' AND column_name='analyzed_at') THEN
        ALTER TABLE documents ADD COLUMN analyzed_at TIMESTAMP;
    END IF;
END $$;

-- Update documents status enum to match new values
DO $$
BEGIN
    -- Drop the old constraint if it exists
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;

    -- Add new constraint with updated values
    ALTER TABLE documents ADD CONSTRAINT documents_status_check
        CHECK (status IN ('uploaded', 'analyzing', 'analyzed', 'failed', 'processing', 'error'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Fix password column name (password_hash -> password)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='users' AND column_name='password_hash')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name='users' AND column_name='password') THEN
        ALTER TABLE users RENAME COLUMN password_hash TO password;
    END IF;
END $$;

-- Update teams table to remove required slug and owner_id (we'll manage ownership via team_members)
DO $$
BEGIN
    -- Make slug nullable
    ALTER TABLE teams ALTER COLUMN slug DROP NOT NULL;
    -- Make owner_id nullable
    ALTER TABLE teams ALTER COLUMN owner_id DROP NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;
