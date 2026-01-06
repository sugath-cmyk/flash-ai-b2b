-- Migration: Add discount and offer extraction support
-- Description: Create tables for Shopify discounts and manual offers, update documents table

-- ============================================================================
-- 1. SHOPIFY DISCOUNTS TABLE
-- ============================================================================
-- Stores discount codes extracted from Shopify Price Rules API
CREATE TABLE IF NOT EXISTS extracted_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Shopify identifiers
  external_id TEXT NOT NULL, -- Composite: price_rule_id + discount_code_id
  price_rule_id TEXT NOT NULL,
  discount_code_id TEXT NOT NULL,

  -- Discount details
  title TEXT NOT NULL,
  code TEXT NOT NULL, -- e.g., "WINTER25", "FREESHIP"
  description TEXT,

  -- Discount value
  value_type TEXT NOT NULL, -- 'percentage', 'fixed_amount', 'free_shipping'
  value NUMERIC NOT NULL, -- 25 for 25%, or 500 for ₹500 off

  -- Application rules
  target_type TEXT, -- 'line_item', 'shipping_line'
  target_selection TEXT, -- 'all', 'entitled'
  customer_selection TEXT, -- 'all', 'prerequisite'
  minimum_requirements JSONB, -- {minimum_purchase_amount: 1000}
  entitled_product_ids TEXT[], -- Specific products this applies to
  entitled_collection_ids TEXT[], -- Specific collections

  -- Usage limits
  usage_limit INTEGER, -- Total usage limit (null = unlimited)
  customer_usage_limit INTEGER, -- Per-customer limit
  usage_count INTEGER DEFAULT 0,

  -- Validity dates
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP, -- null = no expiry
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB, -- Full Shopify response for debugging

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(store_id, external_id)
);

-- Indexes for extracted_discounts
CREATE INDEX idx_discounts_store ON extracted_discounts (store_id);
CREATE INDEX idx_discounts_code ON extracted_discounts (code);
CREATE INDEX idx_discounts_active ON extracted_discounts (is_active, starts_at, ends_at);
CREATE INDEX idx_discounts_dates ON extracted_discounts (starts_at, ends_at);

-- ============================================================================
-- 2. MANUAL OFFERS TABLE
-- ============================================================================
-- Stores offers uploaded via documents or manually created by admins
CREATE TABLE IF NOT EXISTS store_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Offer details
  title TEXT NOT NULL,
  description TEXT,
  offer_type TEXT NOT NULL, -- 'discount_code', 'promotion', 'bundle', 'free_shipping'

  -- Discount value (optional)
  code TEXT, -- Coupon code if applicable
  discount_type TEXT, -- 'percentage', 'fixed_amount', 'free_shipping'
  discount_value NUMERIC, -- 25 for 25%, or 500 for ₹500 off

  -- Application rules
  minimum_purchase NUMERIC,
  applies_to TEXT, -- 'all', 'specific_products', 'specific_collections'
  applies_to_ids TEXT[], -- Product or collection IDs

  -- Bundle offer details (JSON)
  bundle_details JSONB, -- {buy_quantity: 2, get_quantity: 1, products: [...]}

  -- Validity dates
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  -- Source tracking
  source TEXT NOT NULL, -- 'document_upload', 'manual_entry'
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

  -- Rich content
  terms_and_conditions TEXT,
  image_url TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for store_offers
CREATE INDEX idx_offers_store ON store_offers (store_id);
CREATE INDEX idx_offers_active ON store_offers (is_active, start_date, end_date);
CREATE INDEX idx_offers_type ON store_offers (offer_type);
CREATE INDEX idx_offers_code ON store_offers (code) WHERE code IS NOT NULL;

-- ============================================================================
-- 3. UPDATE DOCUMENTS TABLE
-- ============================================================================
-- Add store association and document type classification
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'general';

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_store ON documents (store_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents (document_type);

-- Document type options: 'general', 'discount', 'offer', 'promotion', 'policy', 'faq'
COMMENT ON COLUMN documents.document_type IS 'Types: general, discount, offer, promotion, policy, faq';
COMMENT ON COLUMN documents.store_id IS 'Store association for store-scoped documents';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration enables:
-- 1. Shopify discount code extraction and storage
-- 2. Manual offer upload via PDF/CSV documents
-- 3. Store-scoped document management
-- 4. Bot context integration with active discounts/offers
