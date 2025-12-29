import { pool } from '../config/database';
import { ShopifyAPIService, ShopifyExtractionService } from '../services/shopify-api.service';
import * as crypto from 'crypto';

/**
 * Create store and connect with Shopify credentials
 */

const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'psd001-yx.myshopify.com';
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ SHOPIFY_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

async function main() {
  try {
    console.log('🔍 Step 1: Testing Shopify Connection...\n');

    // Test connection
    const shopifyApi = new ShopifyAPIService(SHOP_DOMAIN, ACCESS_TOKEN!);
    const shopInfo = await shopifyApi.getShop();

    console.log('✅ Connection successful!');
    console.log('   Store Name:', shopInfo.name);
    console.log('   Domain:', shopInfo.domain);
    console.log('   Email:', shopInfo.email);
    console.log('   Products:', await shopifyApi.getProductCount());
    console.log('');

    // Get first user (or create one)
    console.log('🔍 Step 2: Finding user account...');
    let userId;

    const userResult = await pool.query(
      `SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      console.log('No users found. Creating demo user...');
      const newUser = await pool.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, email`,
        [shopInfo.email, 'hashed', 'brand_owner']
      );
      userId = newUser.rows[0].id;
      console.log('✅ Created user:', newUser.rows[0].email);
    } else {
      userId = userResult.rows[0].id;
      console.log('✅ Found user:', userResult.rows[0].email);
    }
    console.log('   User ID:', userId);
    console.log('');

    // Check if store already exists
    console.log('🔍 Step 3: Checking for existing store...');
    const existingStore = await pool.query(
      `SELECT id, store_name FROM stores WHERE shopify_shop_domain = $1 OR domain = $2`,
      [SHOP_DOMAIN, shopInfo.domain]
    );

    let storeId;

    if (existingStore.rows.length > 0) {
      storeId = existingStore.rows[0].id;
      console.log('✅ Found existing store:', existingStore.rows[0].store_name);
      console.log('   Store ID:', storeId);

      // Update credentials
      await pool.query(
        `UPDATE stores
         SET shopify_shop_domain = $1,
             shopify_access_token = $2,
             store_name = $3,
             platform = 'shopify',
             sync_status = 'pending',
             updated_at = NOW()
         WHERE id = $4`,
        [SHOP_DOMAIN, ACCESS_TOKEN, shopInfo.name, storeId]
      );
      console.log('✅ Updated store credentials');
    } else {
      // Create new store
      console.log('Creating new store record...');
      const newStore = await pool.query(
        `INSERT INTO stores (
          user_id, platform, store_name, domain,
          shopify_shop_domain, shopify_access_token,
          sync_status, metadata
        )
        VALUES ($1, 'shopify', $2, $3, $4, $5, 'pending', $6)
        RETURNING id`,
        [
          userId,
          shopInfo.name,
          shopInfo.domain,
          SHOP_DOMAIN,
          ACCESS_TOKEN,
          JSON.stringify({
            shopify_id: shopInfo.id,
            email: shopInfo.email,
            currency: shopInfo.currency,
            country: shopInfo.country_name,
          }),
        ]
      );

      storeId = newStore.rows[0].id;
      console.log('✅ Created new store!');
      console.log('   Store ID:', storeId);

      // Generate widget API key
      const widgetApiKey = 'fa_' + crypto.randomBytes(16).toString('hex');
      await pool.query(
        `INSERT INTO widget_api_keys (store_id, key_name, api_key, is_active)
         VALUES ($1, 'default', $2, true)`,
        [storeId, widgetApiKey]
      );
      console.log('✅ Generated widget API key:', widgetApiKey);
    }
    console.log('');

    // Start sync
    console.log('🚀 Step 4: Starting product sync...');
    console.log('This will take 1-3 minutes for 26 products.\n');

    await ShopifyExtractionService.extractStoreData(storeId);

    console.log('\n✅ Sync completed!\n');

    // Show results
    const stats = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM extracted_products WHERE store_id = $1) as products,
         (SELECT COUNT(*) FROM extracted_collections WHERE store_id = $1) as collections,
         (SELECT COUNT(*) FROM extracted_pages WHERE store_id = $1) as pages`,
      [storeId]
    );

    console.log('📊 Sync Results:');
    console.log('   Products:', stats.rows[0].products);
    console.log('   Collections:', stats.rows[0].collections);
    console.log('   Pages:', stats.rows[0].pages);
    console.log('');

    // Sample products
    const products = await pool.query(
      `SELECT title, price FROM extracted_products WHERE store_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [storeId]
    );

    if (products.rows.length > 0) {
      console.log('📦 Sample Products:');
      products.rows.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title} - ₹${p.price}`);
      });
      console.log('');
    }

    // Widget code
    console.log('📋 Widget Embed Code:');
    console.log('─────────────────────────────────────────');
    console.log(`<script>
  window.flashAIConfig = {
    storeId: '${storeId}'
  };
</script>
<script src="https://flash-ai-backend-rld7.onrender.com/widget/${storeId}.js" async></script>`);
    console.log('─────────────────────────────────────────');
    console.log('');

    console.log('🎉 Success! Your store is connected and synced.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Update widget script on Shopify with new storeId');
    console.log('2. Test the widget on a product page');
    console.log('3. Ask: "What are the ingredients?" or "Tell me about this product"');
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

main();
