#!/bin/bash
# Run this in Render Shell to restore the API key

cat << 'EOF'
Run these commands in Render Shell:
=====================================

# Step 1: Check if API key exists
psql $DATABASE_URL -c "SELECT id, store_id, api_key, is_active FROM widget_api_keys WHERE store_id = '77e65b2a-ce51-4e64-a75e-0d3d5a4b4b84';"

# Step 2: If no results, create the API key
psql $DATABASE_URL -c "INSERT INTO widget_api_keys (id, store_id, key_name, api_key, api_secret, permissions, is_active, created_at) VALUES (gen_random_uuid(), '77e65b2a-ce51-4e64-a75e-0d3d5a4b4b84', 'Production Widget Key', 'sk_06a74e33ffcd26d482ea984e8c1ef613666e4f45062024504ac6449a54a4', 'c70646d464cfe79c869ca18096b6f610c4674abe4b4749d34e816f90adaf31d3ca9777d044a8643682719bdb034ee4a3b0680e514e914317adc4442e84986572', '{\"api\": false, \"widget\": true}', true, NOW()) ON CONFLICT DO NOTHING;"

# Step 3: Verify
psql $DATABASE_URL -c "SELECT 'API Key Created Successfully!' as status, api_key FROM widget_api_keys WHERE store_id = '77e65b2a-ce51-4e64-a75e-0d3d5a4b4b84';"

=====================================
EOF
