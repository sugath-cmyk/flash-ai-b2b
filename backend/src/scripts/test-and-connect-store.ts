import { pool } from '../config/database';
import { ShopifyAPIService, ShopifyExtractionService } from '../services/shopify-api.service';

/**
 * Test and connect store with Shopify credentials
 * This script bypasses HTTP authentication for direct testing
 */

const STORE_ID = process.env.SHOPIFY_STORE_ID || '62130715-ff42-4160-934e-c663fc1e7872';
const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'psd001-yx.myshopify.com';
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ SHOPIFY_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

async function main() {
  try {
    console.log('🔍 Testing Shopify Connection...\n');
    console.log('Store ID:', STORE_ID);
    console.log('Shop Domain:', SHOP_DOMAIN);
    console.log('Access Token:', ACCESS_TOKEN!.substring(0, 15) + '...\n');

    // Step 1: Test connection by fetching shop info
    console.log('Step 1: Validating credentials with Shopify API...');
    let shopInfo;
    let productCount = 0;

    try {
      const shopifyApi = new ShopifyAPIService(SHOP_DOMAIN, ACCESS_TOKEN!);
      shopInfo = await shopifyApi.getShop();

      console.log('✅ Connection successful!');
      console.log('   Store Name:', shopInfo.name);
      console.log('   Domain:', shopInfo.domain);
      console.log('   Email:', shopInfo.email);
      console.log('   Currency:', shopInfo.currency);
      console.log('   Country:', shopInfo.country_name || 'Unknown');

      // Get product count
      try {
        productCount = await shopifyApi.getProductCount();
        console.log('   Products:', productCount);
      } catch (err) {
        console.log('   Products: Unable to fetch count');
      }
      console.log('');
    } catch (error: any) {
      console.error('❌ Failed to connect to Shopify!');

      if (error.response?.status === 401) {
        console.error('   Error: Invalid access token');
        console.error('   Please check your Shopify Admin API credentials.');
      } else if (error.response?.status === 404) {
        console.error('   Error: Store not found');
        console.error('   Please verify the shop domain is correct.');
      } else {
        console.error('   Error:', error.message);
      }

      await pool.end();
      process.exit(1);
    }

    // Step 2: Update store in database
    console.log('Step 2: Updating store credentials in database...');

    const updateResult = await pool.query(
      `UPDATE stores
       SET shopify_shop_domain = $1,
           shopify_access_token = $2,
           store_name = $3,
           domain = $4,
           platform = 'shopify',
           sync_status = 'pending',
           metadata = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, store_name, user_id`,
      [
        SHOP_DOMAIN,
        ACCESS_TOKEN,
        shopInfo.name,
        shopInfo.domain,
        JSON.stringify({
          shopify_id: shopInfo.id,
          email: shopInfo.email,
          currency: shopInfo.currency,
          country: shopInfo.country_name,
          timezone: shopInfo.timezone,
        }),
        STORE_ID,
      ]
    );

    if (updateResult.rows.length === 0) {
      console.error('❌ Store not found in database with ID:', STORE_ID);
      await pool.end();
      process.exit(1);
    }

    console.log('✅ Store credentials updated in database');
    console.log('   User ID:', updateResult.rows[0].user_id);
    console.log('');

    // Step 3: Ensure widget API key exists
    console.log('Step 3: Checking widget API key...');

    const apiKeyResult = await pool.query(
      `SELECT api_key FROM widget_api_keys WHERE store_id = $1 AND is_active = true LIMIT 1`,
      [STORE_ID]
    );

    if (apiKeyResult.rows.length === 0) {
      const crypto = require('crypto');
      const widgetApiKey = 'fa_' + crypto.randomBytes(16).toString('hex');

      await pool.query(
        `INSERT INTO widget_api_keys (store_id, key_name, api_key, is_active)
         VALUES ($1, 'default', $2, true)`,
        [STORE_ID, widgetApiKey]
      );

      console.log('✅ Widget API key generated:', widgetApiKey);
    } else {
      console.log('✅ Widget API key already exists:', apiKeyResult.rows[0].api_key);
    }
    console.log('');

    // Step 4: Start product sync
    console.log('Step 4: Starting product sync from Shopify...');
    console.log('This may take 1-3 minutes depending on product count.\n');

    await ShopifyExtractionService.extractStoreData(STORE_ID);

    console.log('\n✅ Sync completed successfully!\n');

    // Step 5: Show results
    console.log('Step 5: Sync Results');

    const stats = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM extracted_products WHERE store_id = $1) as products,
         (SELECT COUNT(*) FROM extracted_collections WHERE store_id = $1) as collections,
         (SELECT COUNT(*) FROM extracted_pages WHERE store_id = $1) as pages`,
      [STORE_ID]
    );

    console.log('   Products synced:', stats.rows[0].products);
    console.log('   Collections synced:', stats.rows[0].collections);
    console.log('   Pages synced:', stats.rows[0].pages);
    console.log('');

    // Show sample products
    const products = await pool.query(
      `SELECT title, price, vendor FROM extracted_products WHERE store_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [STORE_ID]
    );

    if (products.rows.length > 0) {
      console.log('📦 Sample Products:');
      products.rows.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title} - $${p.price} ${p.vendor ? `(${p.vendor})` : ''}`);
      });
      console.log('');
    }

    // Get widget embed code
    const embedCodeResult = await pool.query(
      `SELECT api_key FROM widget_api_keys WHERE store_id = $1 AND is_active = true LIMIT 1`,
      [STORE_ID]
    );

    if (embedCodeResult.rows.length > 0) {
      const apiKey = embedCodeResult.rows[0].api_key;
      console.log('📋 Widget Embed Code:');
      console.log('─────────────────────────────────────────────────────');
      console.log(`<script>
  window.flashAIConfig = {
    storeId: '${STORE_ID}'
  };
</script>
<script src="https://flash-ai-backend-rld7.onrender.com/widget/${STORE_ID}.js" async></script>`);
      console.log('─────────────────────────────────────────────────────');
      console.log('');
    }

    console.log('🎉 All done! Your AI widget is now ready to answer customer questions.\n');
    console.log('Next steps:');
    console.log('1. ✅ Store connected and synced');
    console.log('2. ✅ Widget is already installed on zorohshop.shop');
    console.log('3. 🧪 Test the widget on any product page');
    console.log('4. 💬 Try asking: "What ingredients are in this product?"');
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
