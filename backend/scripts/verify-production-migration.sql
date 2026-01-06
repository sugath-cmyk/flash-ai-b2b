-- Run this SQL to verify the migration was successful

-- Check if extracted_discounts table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'extracted_discounts'
) AS extracted_discounts_exists;

-- Check if store_offers table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'store_offers'
) AS store_offers_exists;

-- Check if documents table has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name IN ('store_id', 'document_type');

-- Count existing discounts
SELECT COUNT(*) as discount_count FROM extracted_discounts;

-- Count existing offers
SELECT COUNT(*) as offer_count FROM store_offers;
