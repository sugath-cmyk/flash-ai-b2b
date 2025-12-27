-- Add role types and brand associations
-- Update user roles to support platform admin vs brand owners

-- Add role constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'brand_owner', 'user'));
  END IF;
END $$;

-- Add store_id column to users for brand owners (one brand = one store)
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- Create index on store_id
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);

-- Update existing users to admin role (platform admins)
UPDATE users SET role = 'admin' WHERE role = 'user';

-- Add comment
COMMENT ON COLUMN users.store_id IS 'For brand_owner role: links to their store. NULL for admin users.';
