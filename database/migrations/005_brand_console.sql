-- Migration: Brand Console Features
-- Created: 2024-12-24
-- Description: Adds tables for brand console, widget configuration, analytics, and billing

-- Widget Configurations
CREATE TABLE IF NOT EXISTS widget_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    widget_name VARCHAR(100) DEFAULT 'AI Chat Assistant',
    enabled BOOLEAN DEFAULT true,

    -- Appearance
    primary_color VARCHAR(7) DEFAULT '#3B82F6',
    position VARCHAR(20) DEFAULT 'bottom-right', -- bottom-right, bottom-left, top-right, top-left
    greeting_message TEXT DEFAULT 'Hi! How can I help you today?',
    placeholder_text VARCHAR(255) DEFAULT 'Ask me anything...',

    -- Behavior
    auto_open BOOLEAN DEFAULT false,
    show_branding BOOLEAN DEFAULT true,
    response_tone VARCHAR(50) DEFAULT 'friendly', -- friendly, professional, casual

    -- Features
    enable_product_search BOOLEAN DEFAULT true,
    enable_recommendations BOOLEAN DEFAULT true,
    enable_order_tracking BOOLEAN DEFAULT false,

    -- Custom branding
    logo_url TEXT,
    company_name VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(store_id)
);

-- Widget API Keys for Widget Authentication
CREATE TABLE IF NOT EXISTS widget_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    api_secret VARCHAR(128) NOT NULL,

    -- Permissions
    permissions JSONB DEFAULT '{"widget": true, "api": false}'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(store_id, key_name)
);

-- Widget Analytics
CREATE TABLE IF NOT EXISTS widget_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(50) NOT NULL, -- widget_opened, message_sent, product_viewed, etc.
    event_data JSONB,

    -- Session info
    session_id VARCHAR(255),
    visitor_id VARCHAR(255),

    -- Context
    page_url TEXT,
    referrer TEXT,
    device_type VARCHAR(50),
    browser VARCHAR(100),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    -- Plan details
    plan_name VARCHAR(50) NOT NULL, -- starter, professional, enterprise
    plan_interval VARCHAR(20) DEFAULT 'monthly', -- monthly, annual

    -- Pricing
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, canceled, past_due, paused
    trial_ends_at TIMESTAMP,
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,

    -- Limits
    message_limit INTEGER DEFAULT 1000,
    messages_used INTEGER DEFAULT 0,

    -- Billing
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),

    -- Metadata
    canceled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(store_id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    -- Invoice details
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, paid, void, uncollectible

    -- Dates
    invoice_date DATE NOT NULL,
    due_date DATE,
    paid_at TIMESTAMP,

    -- External IDs
    stripe_invoice_id VARCHAR(255),

    -- Metadata
    description TEXT,
    pdf_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Widget Conversations (separate from main AI chat)
CREATE TABLE IF NOT EXISTS widget_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    -- Visitor info
    session_id VARCHAR(255) NOT NULL,
    visitor_id VARCHAR(255),
    visitor_email VARCHAR(255),
    visitor_name VARCHAR(255),

    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, resolved, abandoned

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Widget Messages
CREATE TABLE IF NOT EXISTS widget_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES widget_conversations(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    -- Message details
    role VARCHAR(20) NOT NULL, -- user, assistant
    content TEXT NOT NULL,

    -- AI metadata
    model VARCHAR(50),
    tokens INTEGER,

    -- Product context (if message was about a product)
    product_id UUID REFERENCES extracted_products(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_widget_configs_store ON widget_configs(store_id);
CREATE INDEX IF NOT EXISTS idx_widget_api_keys_store ON widget_api_keys(store_id);
CREATE INDEX IF NOT EXISTS idx_widget_api_keys_key ON widget_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_widget_analytics_store ON widget_analytics(store_id);
CREATE INDEX IF NOT EXISTS idx_widget_analytics_created ON widget_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_widget_analytics_event ON widget_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_store ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_store ON invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_widget_conversations_store ON widget_conversations(store_id);
CREATE INDEX IF NOT EXISTS idx_widget_conversations_session ON widget_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_widget_messages_conversation ON widget_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_widget_messages_store ON widget_messages(store_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_widget_configs_updated_at ON widget_configs;
CREATE TRIGGER update_widget_configs_updated_at BEFORE UPDATE ON widget_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_widget_conversations_updated_at ON widget_conversations;
CREATE TRIGGER update_widget_conversations_updated_at BEFORE UPDATE ON widget_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add user_type to users table to distinguish admin vs brand users
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'admin';
-- admin: platform admin, brand: brand store owner

COMMENT ON TABLE widget_configs IS 'Configuration for embeddable chat widget';
COMMENT ON TABLE widget_api_keys IS 'API keys for widget authentication and API access';
COMMENT ON TABLE widget_analytics IS 'Analytics events from the embedded widget';
COMMENT ON TABLE subscriptions IS 'Subscription plans for brand stores';
COMMENT ON TABLE invoices IS 'Billing invoices for subscriptions';
COMMENT ON TABLE widget_conversations IS 'Customer conversations through the widget';
COMMENT ON TABLE widget_messages IS 'Messages in widget conversations';
