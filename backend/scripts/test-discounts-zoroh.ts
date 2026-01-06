/**
 * Test script to extract discounts from Shopify for Zoroh store
 */
import { ShopifyExtractionService } from '../src/services/shopify-api.service';
import { pool } from '../src/config/database';
import dotenv from 'dotenv';

dotenv.config();

async function testDiscountExtraction() {
  try {
    const storeId = '77e65b2a-ce51-4e64-a75e-0d3d5a4b4b84';

    console.log('🔍 Testing Shopify discount extraction...\n');
    console.log(`Store ID: ${storeId}\n`);

    // Check current discounts before extraction
    const beforeResult = await pool.query(
      'SELECT COUNT(*) as count FROM extracted_discounts WHERE store_id = $1',
      [storeId]
    );
    console.log(`Discounts in DB before extraction: ${beforeResult.rows[0].count}\n`);

    // Trigger full extraction (includes discounts)
    console.log('📦 Starting full Shopify extraction (includes discounts)...');
    await ShopifyExtractionService.extractStoreData(storeId);

    // Query extracted discounts
    const afterResult = await pool.query(
      `SELECT code, title, value_type, value, starts_at, ends_at, is_active, usage_count
       FROM extracted_discounts
       WHERE store_id = $1
       ORDER BY starts_at DESC`,
      [storeId]
    );

    console.log(`\n✅ Extraction completed!`);
    console.log(`\n📊 Total discounts in DB: ${afterResult.rows.length}\n`);

    if (afterResult.rows.length > 0) {
      console.log('Discount details:');
      console.log('================\n');

      afterResult.rows.forEach((discount, idx) => {
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
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDiscountExtraction();
