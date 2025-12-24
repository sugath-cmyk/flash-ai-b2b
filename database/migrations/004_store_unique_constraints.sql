-- Migration: Add unique constraints for store extraction tables
-- Created: 2024-12-24
-- Description: Adds missing unique constraints to prevent duplicate data

-- Add unique constraint for collections
ALTER TABLE extracted_collections
ADD CONSTRAINT unique_store_collection UNIQUE (store_id, external_id);

-- Add unique constraint for pages
ALTER TABLE extracted_pages
ADD CONSTRAINT unique_store_page UNIQUE (store_id, handle);
