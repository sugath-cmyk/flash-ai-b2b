#!/bin/bash
# Find the correct Zoroh store in production

cat << 'EOF'
Run these commands in Render Shell:
=====================================

# Find all stores in production
psql $DATABASE_URL -c "SELECT id, name, domain, created_at FROM stores ORDER BY created_at DESC;"

# Find Zoroh store specifically
psql $DATABASE_URL -c "SELECT id, name, domain, created_at FROM stores WHERE name ILIKE '%zoroh%' OR domain ILIKE '%zoroh%';"

# Check if there are any API keys at all
psql $DATABASE_URL -c "SELECT store_id, key_name, api_key, is_active FROM widget_api_keys;"

=====================================
EOF
