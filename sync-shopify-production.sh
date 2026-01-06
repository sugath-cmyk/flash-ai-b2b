#!/bin/bash
# Sync Shopify data in production to get accurate prices

cat << 'EOF'
Run these commands in Render Shell:
=====================================

# Step 1: Check current price in database
echo "=== Current price in database ==="
psql $DATABASE_URL -c "SELECT title, price, compare_at_price FROM extracted_products WHERE store_id = '62130715-ff42-4160-934e-c663fc1e7872' AND title ILIKE '%absolut%repair%';"

# Step 2: Get store details to trigger sync
echo ""
echo "=== Store connection details ==="
psql $DATABASE_URL -c "SELECT id, shopify_store_url, access_token IS NOT NULL as has_token FROM stores WHERE id = '62130715-ff42-4160-934e-c663fc1e7872';"

# Step 3: Manually trigger sync by calling the extraction service
echo ""
echo "=== Triggering Shopify sync ==="
cd /opt/render/project/src/backend && NODE_ENV=production npx ts-node -e "
import { ShopifyExtractionService } from './src/services/shopify-api.service';
(async () => {
  try {
    await ShopifyExtractionService.extractStoreData('62130715-ff42-4160-934e-c663fc1e7872');
    console.log('✅ Sync completed successfully');
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
  }
  process.exit(0);
})();
"

# Step 4: Verify updated prices
echo ""
echo "=== Prices after sync ==="
psql $DATABASE_URL -c "SELECT title, price, compare_at_price, updated_at FROM extracted_products WHERE store_id = '62130715-ff42-4160-934e-c663fc1e7872' AND title ILIKE '%absolut%repair%';"

=====================================
EOF
