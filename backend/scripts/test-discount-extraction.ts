/**
 * Test script to extract discounts from Shopify for Zoroh store
 */
import { ShopifyExtractionService } from '../src/services/shopify-api.service';
import { pool } from '../src/config/database';
import dotenv from 'dotenv';

dotenv.config();

async function testDiscountExtraction() {
  try {
    console.log('🔍 Testing Shopify discount extraction...\n');

    // Get Zoroh store ID
    const storeResult = await pool.query(
      `SELECT id, store_name, shopify_shop_domain
       FROM stores
       WHERE shopify_shop_domain LIKE '%zoroh%'
       LIMIT 1`
    );

    if (storeResult.rows.length === 0) {
      console.error('❌ Zoroh store not found');
      process.exit(1);
    }

    const store = storeResult.rows[0];
    console.log(`Found store: ${store.store_name} (${store.shopify_shop_domain})`);
    console.log(`Store ID: ${store.id}\n`);

    // Trigger full extraction (includes discounts)
    console.log('📦 Starting full Shopify extraction (includes discounts)...');
    await ShopifyExtractionService.extractStoreData(store.id);

    // Query extracted discounts
    const discountsResult = await pool.query(
      `SELECT code, title, value_type, value, starts_at, ends_at, is_active, usage_count
       FROM extracted_discounts
       WHERE store_id = $1
       ORDER BY starts_at DESC`,
      [store.id]
    );

    console.log(`\n✅ Extraction completed!`);
    console.log(`\n📊 Discounts extracted: ${discountsResult.rows.length}\n`);

    if (discountsResult.rows.length > 0) {
      console.log('Discount details:');
      console.log('================\n');

      discountsResult.rows.forEach((discount, idx) => {
        console.log(`${idx + 1}. ${discount.title}`);
        console.log(`   Code: ${discount.code}`);
        console.log(`   Type: ${discount.value_type}`);
        console.log(`   Value: ${discount.value}`);
        console.log(`   Active: ${discount.is_active ? '✅ Yes' : '❌ No'}`);
        console.log(`   Usage: ${discount.usage_count} times`);
        console.log(`   Valid: ${new Date(discount.starts_at).toLocaleDateString()} - ${discount.ends_at ? new Date(discount.ends_at).toLocaleDateString() : 'No expiry'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No active discounts found. This could mean:');
      console.log('   - The store has no discount codes configured');
      console.log('   - All discount codes have expired');
      console.log('   - The OAuth scopes may not include discount access');
    }

    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error during discount extraction:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDiscountExtraction();
