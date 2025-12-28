-- Add admin credentials to onboarding requests
-- These credentials will be used to create brand owner accounts

ALTER TABLE onboarding_requests
ADD COLUMN IF NOT EXISTS admin_username VARCHAR(100),
ADD COLUMN IF NOT EXISTS admin_password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT TRUE;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_username ON onboarding_requests(admin_username);

-- Comments
COMMENT ON COLUMN onboarding_requests.admin_username IS 'Username for brand owner account (will be created upon approval)';
COMMENT ON COLUMN onboarding_requests.admin_password_hash IS 'Hashed password for brand owner account';
COMMENT ON COLUMN onboarding_requests.email_verified IS 'Whether email verification is complete';
COMMENT ON COLUMN onboarding_requests.phone_verified IS 'Whether phone verification is complete';
