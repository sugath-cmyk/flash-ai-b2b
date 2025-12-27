-- Onboarding System
-- Stores brand onboarding requests and profile information

-- Onboarding requests table
CREATE TABLE IF NOT EXISTS onboarding_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    store_url TEXT NOT NULL,
    store_platform VARCHAR(50),
    business_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    gst_number VARCHAR(50),
    monthly_traffic VARCHAR(50),
    current_support TEXT,
    hear_about_us VARCHAR(100),
    additional_info TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    admin_notes TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brand profiles table (extended information)
CREATE TABLE IF NOT EXISTS brand_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    brand_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    business_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    gst_number VARCHAR(50),
    website_url TEXT,
    logo_url TEXT,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_requests(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_email ON onboarding_requests(email);
CREATE INDEX IF NOT EXISTS idx_onboarding_created ON onboarding_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_store ON brand_profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_user ON brand_profiles(user_id);

-- Triggers
CREATE TRIGGER update_onboarding_requests_updated_at
    BEFORE UPDATE ON onboarding_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_profiles_updated_at
    BEFORE UPDATE ON brand_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE onboarding_requests IS 'Stores brand onboarding form submissions';
COMMENT ON TABLE brand_profiles IS 'Extended brand information and business details';
COMMENT ON COLUMN onboarding_requests.status IS 'pending, approved, rejected';
