#!/bin/bash
# Check the actual price of Absolut Repair Hair Mask in PRODUCTION database

cat << 'EOF'
Run this in Render Shell to check the product price:
=====================================

# Find the Absolut Repair Hair Mask product
psql $DATABASE_URL -c "SELECT id, title, price, compare_at_price, shopify_product_id FROM products WHERE store_id = '62130715-ff42-4160-934e-c663fc1e7872' AND title ILIKE '%absolut%repair%' LIMIT 5;"

# Check all variants for this product
psql $DATABASE_URL -c "SELECT p.title, pv.title as variant_title, pv.price, pv.compare_at_price, pv.shopify_variant_id FROM products p JOIN product_variants pv ON p.id = pv.product_id WHERE p.store_id = '62130715-ff42-4160-934e-c663fc1e7872' AND p.title ILIKE '%absolut%repair%';"

=====================================
EOF
