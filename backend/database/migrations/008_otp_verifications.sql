-- Create OTP verifications table
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    phone VARCHAR(50),
    otp_code VARCHAR(10) NOT NULL,
    otp_type VARCHAR(20) NOT NULL CHECK (otp_type IN ('email', 'phone')),
    verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);

-- Add admin credentials columns to onboarding_requests
ALTER TABLE onboarding_requests
ADD COLUMN IF NOT EXISTS admin_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS admin_password_hash TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

COMMENT ON TABLE otp_verifications IS 'Stores OTP codes for email and phone verification';
COMMENT ON COLUMN onboarding_requests.admin_username IS 'Desired admin username for brand owner';
COMMENT ON COLUMN onboarding_requests.admin_password_hash IS 'Hashed password for brand owner admin account';
