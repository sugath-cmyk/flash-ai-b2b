-- Migration: Add unique constraints for store extraction tables
-- Created: 2024-12-24
-- Description: Adds missing unique constraints to prevent duplicate data

-- Add unique constraint for collections (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_store_collection'
    ) THEN
        ALTER TABLE extracted_collections
        ADD CONSTRAINT unique_store_collection UNIQUE (store_id, external_id);
    END IF;
END $$;

-- Add unique constraint for pages (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_store_page'
    ) THEN
        ALTER TABLE extracted_pages
        ADD CONSTRAINT unique_store_page UNIQUE (store_id, handle);
    END IF;
END $$;
