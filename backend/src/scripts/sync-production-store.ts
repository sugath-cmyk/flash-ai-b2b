import { pool } from '../config/database';
import { ShopifyAPIService, ShopifyExtractionService } from '../services/shopify-api.service';

/**
 * Sync production store with Shopify credentials
 * Run this on Render: npx ts-node src/scripts/sync-production-store.ts
 */

const STORE_ID = process.env.SHOPIFY_STORE_ID || '62130715-ff42-4160-934e-c663fc1e7872'; // Production store ID
const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'psd001-yx.myshopify.com';
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ SHOPIFY_ACCESS_TOKEN environment variable is required');
  console.error('Usage: SHOPIFY_ACCESS_TOKEN=shpat_xxx npm run sync-production');
  process.exit(1);
}

async function main() {
  try {
    console.log('🚀 Flash AI - Production Store Sync');
    console.log('=====================================\n');
    console.log('Store ID:', STORE_ID);
    console.log('Shop Domain:', SHOP_DOMAIN);
    console.log('');

    // Step 1: Test Shopify connection
    console.log('Step 1: Testing Shopify connection...');
    const shopifyApi = new ShopifyAPIService(SHOP_DOMAIN, ACCESS_TOKEN!);
    const shopInfo = await shopifyApi.getShop();

    console.log('✅ Connected to Shopify!');
    console.log('   Store:', shopInfo.name);
    console.log('   Domain:', shopInfo.domain);
    console.log('   Products:', await shopifyApi.getProductCount().catch(() => 'Unknown'));
    console.log('');

    // Step 2: Update store credentials in database
    console.log('Step 2: Updating store credentials...');

    const updateResult = await pool.query(
      `UPDATE stores
       SET shopify_shop_domain = $1,
           shopify_access_token = $2,
           store_name = $3,
           platform = 'shopify',
           sync_status = 'pending',
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, store_name`,
      [SHOP_DOMAIN, ACCESS_TOKEN, shopInfo.name, STORE_ID]
    );

    if (updateResult.rows.length === 0) {
      console.error('❌ Store not found in database');
      console.error('   Looking for store ID:', STORE_ID);
      console.error('   This store may need to be created first.');
      await pool.end();
      process.exit(1);
    }

    console.log('✅ Store credentials updated');
    console.log('');

    // Step 3: Start product sync
    console.log('Step 3: Starting product sync...');
    console.log('This will take 1-3 minutes.\n');

    await ShopifyExtractionService.extractStoreData(STORE_ID);

    console.log('\n✅ Sync completed!\n');

    // Step 4: Show results
    const stats = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM extracted_products WHERE store_id = $1) as products,
         (SELECT COUNT(*) FROM extracted_collections WHERE store_id = $1) as collections,
         (SELECT COUNT(*) FROM extracted_pages WHERE store_id = $1) as pages`,
      [STORE_ID]
    );

    console.log('📊 Sync Results:');
    console.log('   Products:', stats.rows[0].products);
    console.log('   Collections:', stats.rows[0].collections);
    console.log('   Pages:', stats.rows[0].pages);
    console.log('');

    // Show sample products
    const products = await pool.query(
      `SELECT title, price FROM extracted_products
       WHERE store_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [STORE_ID]
    );

    if (products.rows.length > 0) {
      console.log('📦 Sample Products:');
      products.rows.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title} - ₹${p.price}`);
      });
      console.log('');
    }

    console.log('🎉 Success! Your AI widget is now ready.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Visit any product page on zorohshop.shop');
    console.log('2. Look for "Questions? Ask AI" widget');
    console.log('3. Test by asking about product ingredients or benefits');
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

main();
