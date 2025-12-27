-- Migration: Shopify Integration
-- Created: 2025-12-27
-- Description: Adds Shopify OAuth, webhook subscriptions, and widget customization

-- Add Shopify-specific columns to stores table
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS shopify_shop_domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS shopify_access_token TEXT,
ADD COLUMN IF NOT EXISTS shopify_scopes TEXT,
ADD COLUMN IF NOT EXISTS shopify_installed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_frequency VARCHAR(20) DEFAULT 'daily';

-- Create index for Shopify shop domain lookups
CREATE INDEX IF NOT EXISTS idx_stores_shopify_domain ON stores(shopify_shop_domain);

-- Shopify OAuth State Tracking
-- Stores temporary OAuth state tokens for security
CREATE TABLE IF NOT EXISTS shopify_oauth_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_token VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_domain VARCHAR(255) NOT NULL,
    redirect_uri TEXT,
    scopes TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast state token lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON shopify_oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user ON shopify_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON shopify_oauth_states(expires_at);

-- Webhook Subscriptions
-- Tracks active Shopify webhook subscriptions for real-time sync
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    webhook_id VARCHAR(255) NOT NULL, -- Shopify webhook ID
    topic VARCHAR(100) NOT NULL, -- e.g., products/create, products/update
    address TEXT NOT NULL, -- webhook callback URL
    format VARCHAR(10) DEFAULT 'json',
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, error
    last_triggered TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, topic)
);

-- Indexes for webhook lookups
CREATE INDEX IF NOT EXISTS idx_webhooks_store ON webhook_subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_topic ON webhook_subscriptions(topic);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhook_subscriptions(status);

-- Webhook Events Log
-- Logs all incoming webhook events for debugging and replay
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    topic VARCHAR(100) NOT NULL,
    webhook_id VARCHAR(255),
    payload JSONB NOT NULL,
    headers JSONB,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Index for webhook event queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_store ON webhook_events(store_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_topic ON webhook_events(topic);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at DESC);

-- Update existing widget_configs table with additional customization columns
-- (widget_configs table already exists from earlier migration)
ALTER TABLE widget_configs
ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#059669',
ADD COLUMN IF NOT EXISTS text_color VARCHAR(7) DEFAULT '#1f2937',
ADD COLUMN IF NOT EXISTS background_color VARCHAR(7) DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS widget_size VARCHAR(20) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS button_style VARCHAR(20) DEFAULT 'pill',
ADD COLUMN IF NOT EXISTS button_text VARCHAR(100) DEFAULT 'Ask Anything',
ADD COLUMN IF NOT EXISTS powered_by_text VARCHAR(100) DEFAULT 'Powered by Flash AI',
ADD COLUMN IF NOT EXISTS auto_open_delay INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS enable_sound BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_typing_indicator BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS quick_questions JSONB,
ADD COLUMN IF NOT EXISTS custom_css TEXT,
ADD COLUMN IF NOT EXISTS custom_js TEXT,
ADD COLUMN IF NOT EXISTS allowed_domains TEXT[];

-- API Keys for Widget Access
-- Allows brands to embed widget on their storefront with scoped API keys
CREATE TABLE IF NOT EXISTS brand_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) NOT NULL UNIQUE, -- Format: sk_[random]
    key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for display
    scopes TEXT[] DEFAULT ARRAY['widget:read', 'widget:chat'], -- Permissions
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP, -- NULL = never expires
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    revoked_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Indexes for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_store ON brand_api_keys(store_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON brand_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked ON brand_api_keys(revoked);

-- Update triggers
CREATE TRIGGER update_webhook_subscriptions_updated_at
    BEFORE UPDATE ON webhook_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_configs_updated_at
    BEFORE UPDATE ON widget_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE shopify_oauth_states IS 'Temporary OAuth state tokens for Shopify app installation security';
COMMENT ON TABLE webhook_subscriptions IS 'Active Shopify webhook subscriptions for real-time data sync';
COMMENT ON TABLE webhook_events IS 'Log of all incoming webhook events for debugging and replay';
-- Note: widget_configs table already exists, we've just added additional columns for enhanced customization
COMMENT ON TABLE brand_api_keys IS 'Scoped API keys for brands to embed widget on their storefront';

COMMENT ON COLUMN stores.shopify_shop_domain IS 'The Shopify shop domain (e.g., mystore.myshopify.com)';
COMMENT ON COLUMN stores.shopify_access_token IS 'Shopify Admin API access token (encrypted)';
COMMENT ON COLUMN stores.shopify_scopes IS 'Comma-separated list of granted OAuth scopes';
COMMENT ON COLUMN stores.auto_sync_enabled IS 'Enable automatic background sync from Shopify';
COMMENT ON COLUMN stores.sync_frequency IS 'How often to sync: hourly, daily, weekly';

COMMENT ON COLUMN widget_configs.quick_questions IS 'Array of quick question strings to display as buttons';
COMMENT ON COLUMN widget_configs.allowed_domains IS 'Whitelist of domains where widget can be embedded';
COMMENT ON COLUMN widget_configs.custom_css IS 'Custom CSS to inject into widget (advanced users)';
COMMENT ON COLUMN widget_configs.custom_js IS 'Custom JavaScript for widget behavior (advanced users)';
