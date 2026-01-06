#!/bin/bash
# Check what's in production

cat << 'EOF'
Run these commands in Render Shell to check actual data:
=====================================

# 1. Check stores table structure
psql $DATABASE_URL -c "\d stores"

# 2. Get store details
psql $DATABASE_URL -c "SELECT id, user_id, access_token IS NOT NULL as has_token, created_at FROM stores WHERE id = '62130715-ff42-4160-934e-c663fc1e7872';"

# 3. Count products by type
psql $DATABASE_URL -c "SELECT product_type, COUNT(*) FROM extracted_products WHERE store_id = '62130715-ff42-4160-934e-c663fc1e7872' GROUP BY product_type;"

# 4. List hair shampoos only
psql $DATABASE_URL -c "SELECT title, price FROM extracted_products WHERE store_id = '62130715-ff42-4160-934e-c663fc1e7872' AND title ILIKE '%shampoo%';"

# 5. Check Absolut Repair variants
psql $DATABASE_URL -c "SELECT p.title, p.price, pv.title as variant, pv.price as variant_price FROM extracted_products p LEFT JOIN product_variants pv ON p.id = pv.product_id WHERE p.store_id = '62130715-ff42-4160-934e-c663fc1e7872' AND p.title ILIKE '%absolut%repair%';"

=====================================
EOF
