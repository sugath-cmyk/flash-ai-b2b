-- Migration: Store Extraction Feature
-- Created: 2024-12-24
-- Description: Adds tables for e-commerce store data extraction

-- Stores Table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50), -- shopify, woocommerce, bigcommerce, magento, custom
    store_url TEXT NOT NULL,
    store_name VARCHAR(255),
    domain VARCHAR(255),
    access_token TEXT, -- encrypted API token
    api_key TEXT, -- encrypted API key
    api_secret TEXT, -- encrypted API secret
    sync_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    last_sync TIMESTAMP,
    metadata JSONB, -- store info, currency, timezone, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extracted Products
CREATE TABLE IF NOT EXISTS extracted_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    external_id VARCHAR(255), -- platform-specific product ID
    title VARCHAR(500),
    description TEXT,
    short_description TEXT,
    price DECIMAL(10,2),
    compare_at_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    sku VARCHAR(255),
    barcode VARCHAR(255),
    weight DECIMAL(10,2),
    weight_unit VARCHAR(10),
    inventory INTEGER,
    product_type VARCHAR(100),
    vendor VARCHAR(255),
    handle VARCHAR(255),
    status VARCHAR(50),
    images JSONB, -- array of image objects
    variants JSONB, -- array of variant objects
    options JSONB, -- array of option objects
    tags TEXT[], -- array of tags
    seo_title VARCHAR(255),
    seo_description TEXT,
    raw_data JSONB, -- full platform data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, external_id)
);

-- Product Reviews
CREATE TABLE IF NOT EXISTS extracted_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES extracted_products(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(500),
    content TEXT,
    reviewer_name VARCHAR(255),
    reviewer_email VARCHAR(255),
    verified_purchase BOOLEAN DEFAULT false,
    helpful_count INTEGER DEFAULT 0,
    images JSONB,
    sentiment VARCHAR(20), -- positive, neutral, negative
    review_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store Pages (About, FAQ, Terms, Privacy, etc.)
CREATE TABLE IF NOT EXISTS extracted_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    page_type VARCHAR(50), -- about, faq, terms, privacy, shipping, returns, etc.
    title VARCHAR(500),
    content TEXT,
    url TEXT,
    handle VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store Collections/Categories
CREATE TABLE IF NOT EXISTS extracted_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    title VARCHAR(255),
    description TEXT,
    handle VARCHAR(255),
    image_url TEXT,
    product_count INTEGER DEFAULT 0,
    sort_order VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extraction Jobs
CREATE TABLE IF NOT EXISTS extraction_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    job_type VARCHAR(50) DEFAULT 'full', -- full, incremental, products_only, etc.
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    progress INTEGER DEFAULT 0, -- 0-100
    total_items INTEGER,
    items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_domain ON stores(domain);
CREATE INDEX IF NOT EXISTS idx_stores_platform ON stores(platform);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON extracted_products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_external_id ON extracted_products(external_id);
CREATE INDEX IF NOT EXISTS idx_products_title ON extracted_products USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_products_tags ON extracted_products USING gin(tags);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON extracted_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON extracted_reviews(rating);

CREATE INDEX IF NOT EXISTS idx_pages_store_id ON extracted_pages(store_id);
CREATE INDEX IF NOT EXISTS idx_pages_type ON extracted_pages(page_type);

CREATE INDEX IF NOT EXISTS idx_collections_store_id ON extracted_collections(store_id);

CREATE INDEX IF NOT EXISTS idx_jobs_store_id ON extraction_jobs(store_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON extraction_jobs(status);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_extracted_products_updated_at ON extracted_products;
CREATE TRIGGER update_extracted_products_updated_at BEFORE UPDATE ON extracted_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_extracted_pages_updated_at ON extracted_pages;
CREATE TRIGGER update_extracted_pages_updated_at BEFORE UPDATE ON extracted_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
