#!/bin/bash
# Check the actual store structure

cat << 'EOF'
Run these commands in Render Shell:
=====================================

# 1. Check stores table structure
psql $DATABASE_URL -c "\d stores"

# 2. Get all stores (without name column)
psql $DATABASE_URL -c "SELECT * FROM stores;"

# 3. Check if this is Zoroh store by looking at shopify data
psql $DATABASE_URL -c "SELECT id, shopify_store_url, user_id FROM stores WHERE id = '62130715-ff42-4160-934e-c663fc1e7872';"

=====================================
EOF
