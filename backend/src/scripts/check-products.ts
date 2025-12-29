import { pool } from '../config/database';

/**
 * Check if products exist in production database
 * Usage: npx ts-node src/scripts/check-products.ts
 */

const STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

async function main() {
  try {
    console.log('🔍 Checking Production Database...\n');
    console.log('Store ID:', STORE_ID);
    console.log('');

    // Check store exists
    const storeResult = await pool.query(
      'SELECT id, store_name, domain, platform FROM stores WHERE id = $1',
      [STORE_ID]
    );

    if (storeResult.rows.length === 0) {
      console.error('❌ Store not found in database!');
      await pool.end();
      process.exit(1);
    }

    console.log('✅ Store found:', storeResult.rows[0].store_name);
    console.log('   Platform:', storeResult.rows[0].platform);
    console.log('');

    // Check products
    const productsResult = await pool.query(
      `SELECT COUNT(*) as count FROM extracted_products WHERE store_id = $1`,
      [STORE_ID]
    );

    const productCount = parseInt(productsResult.rows[0].count);
    console.log('📦 Products:', productCount);

    if (productCount === 0) {
      console.error('❌ NO PRODUCTS FOUND! Need to sync.');
      await pool.end();
      process.exit(1);
    }

    // Show sample products
    const sampleProducts = await pool.query(
      `SELECT title, description, price FROM extracted_products
       WHERE store_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [STORE_ID]
    );

    console.log('\n📦 Sample Products:');
    sampleProducts.rows.forEach((p, i) => {
      console.log(`${i + 1}. ${p.title} - ₹${p.price}`);
      if (p.description) {
        const desc = p.description.replace(/<[^>]*>/g, '').substring(0, 100);
        console.log(`   Description: ${desc}...`);
      }
    });

    // Check collections
    const collectionsResult = await pool.query(
      `SELECT COUNT(*) as count FROM extracted_collections WHERE store_id = $1`,
      [STORE_ID]
    );
    console.log('\n📚 Collections:', collectionsResult.rows[0].count);

    // Check pages
    const pagesResult = await pool.query(
      `SELECT COUNT(*) as count FROM extracted_pages WHERE store_id = $1`,
      [STORE_ID]
    );
    console.log('📄 Pages:', pagesResult.rows[0].count);

    console.log('\n✅ Database check complete!');
    console.log('Products are synced and ready for AI.');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

main();
