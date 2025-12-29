import { pool } from '../config/database';
import { ShopifyExtractionService } from '../services/shopify-api.service';

/**
 * Script to update Shopify credentials and trigger sync
 * Usage: SHOPIFY_ACCESS_TOKEN=shpat_xxx npm run sync-shopify
 *
 * Environment variables:
 * - SHOPIFY_ACCESS_TOKEN (required): Shopify Admin API access token
 * - SHOPIFY_SHOP_DOMAIN (optional): e.g., mystore.myshopify.com
 * - SHOPIFY_STORE_ID (optional): Store ID in database
 */

async function main() {
  try {
    console.log('🔄 Updating Shopify credentials...\n');

    const storeId = process.env.SHOPIFY_STORE_ID || '62130715-ff42-4160-934e-c663fc1e7872';
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || 'psd001-yx.myshopify.com';
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!accessToken) {
      console.error('❌ SHOPIFY_ACCESS_TOKEN environment variable is required');
      console.log('Usage: SHOPIFY_ACCESS_TOKEN=shpat_xxx npm run sync-shopify');
      process.exit(1);
    }

    // Update store with Shopify credentials
    const result = await pool.query(
      `UPDATE stores
       SET shopify_shop_domain = $1,
           shopify_access_token = $2,
           platform = 'shopify',
           sync_status = 'pending',
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, store_name, domain, platform, sync_status`,
      [shopDomain, accessToken, storeId]
    );

    if (result.rows.length === 0) {
      console.error('❌ Store not found with ID:', storeId);
      process.exit(1);
    }

    console.log('✅ Store credentials updated successfully:');
    console.log('   Store ID:', result.rows[0].id);
    console.log('   Store Name:', result.rows[0].store_name || 'N/A');
    console.log('   Domain:', result.rows[0].domain);
    console.log('   Platform:', result.rows[0].platform);
    console.log('   Sync Status:', result.rows[0].sync_status);
    console.log('');

    // Trigger data extraction
    console.log('🚀 Starting product sync from Shopify...\n');

    await ShopifyExtractionService.extractStoreData(storeId);

    console.log('\n✅ Sync completed successfully!\n');

    // Show stats
    const stats = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM extracted_products WHERE store_id = $1) as products_count,
         (SELECT COUNT(*) FROM extracted_collections WHERE store_id = $1) as collections_count,
         (SELECT COUNT(*) FROM extracted_pages WHERE store_id = $1) as pages_count`,
      [storeId]
    );

    console.log('📊 Sync Statistics:');
    console.log('   Products:', stats.rows[0].products_count);
    console.log('   Collections:', stats.rows[0].collections_count);
    console.log('   Pages:', stats.rows[0].pages_count);
    console.log('');

    // Show sample products
    const products = await pool.query(
      `SELECT title, price, vendor FROM extracted_products WHERE store_id = $1 LIMIT 5`,
      [storeId]
    );

    if (products.rows.length > 0) {
      console.log('📦 Sample Products:');
      products.rows.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title} - $${p.price} (${p.vendor || 'No vendor'})`);
      });
      console.log('');
    }

    console.log('🎉 All done! Your widget is now ready to answer product questions.\n');

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
