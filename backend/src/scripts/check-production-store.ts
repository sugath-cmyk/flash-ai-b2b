import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function checkProductionStore() {
  const storeIdFromURL = '62130715-ff42-4160-934e-c663fc1e7872';

  try {
    console.log('🔍 Checking Production Database\n');
    console.log('=' .repeat(60));
    console.log(`Store ID from URL: ${storeIdFromURL}\n`);

    // Check if store exists
    const storeCheck = await pool.query(
      'SELECT id, store_name, domain, created_at FROM stores WHERE id = $1',
      [storeIdFromURL]
    );

    if (storeCheck.rows.length === 0) {
      console.log('❌ PROBLEM FOUND: This store does not exist in production database!\n');
      console.log('This explains why no data is showing.\n');

      // Show available stores
      console.log('Available stores in production:');
      const allStores = await pool.query('SELECT id, store_name, domain FROM stores LIMIT 10');
      allStores.rows.forEach((store, idx) => {
        console.log(`  ${idx + 1}. ${store.store_name || store.domain}`);
        console.log(`     ID: ${store.id}`);
        console.log(`     URL: https://flash-ai-b2b.vercel.app/brand/${store.id}/dashboard\n`);
      });

      console.log('💡 SOLUTION: Use one of the store IDs above in your browser URL.\n');
      process.exit(0);
    }

    const store = storeCheck.rows[0];
    console.log('✅ Store exists in production!');
    console.log(`   Name: ${store.store_name || 'N/A'}`);
    console.log(`   Domain: ${store.domain || 'N/A'}`);
    console.log(`   Created: ${store.created_at}\n`);

    // Check conversations
    const conversationsCheck = await pool.query(
      'SELECT COUNT(*) as count FROM widget_conversations WHERE store_id = $1',
      [storeIdFromURL]
    );
    const convCount = parseInt(conversationsCheck.rows[0].count);
    console.log(`📊 Conversations: ${convCount}`);

    // Check messages
    const messagesCheck = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE role = 'user') as user_msgs,
        COUNT(*) FILTER (WHERE query_category IS NOT NULL) as categorized
       FROM widget_messages
       WHERE store_id = $1`,
      [storeIdFromURL]
    );
    const msgStats = messagesCheck.rows[0];
    console.log(`📨 Messages: ${msgStats.total} (${msgStats.user_msgs} queries)`);
    console.log(`🏷️  Categorized: ${msgStats.categorized}\n`);

    // Check if migration ran
    const migrationCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'widget_messages' AND column_name = 'query_category'
      ) as migration_ran
    `);
    const migrationRan = migrationCheck.rows[0].migration_ran;
    console.log(`🔧 Migration status: ${migrationRan ? '✅ Ran' : '❌ NOT RUN'}\n`);

    if (!migrationRan) {
      console.log('❌ PROBLEM: Migration did not run on production!');
      console.log('The analytics columns are missing from the database.\n');
      console.log('FIX: Run this command to apply migration:');
      console.log('psql $DATABASE_URL < database/migrations/010_query_analytics.sql\n');
      process.exit(1);
    }

    if (convCount === 0) {
      console.log('💡 No data yet for this store.');
      console.log('Generate some data by chatting with the widget on the product page!\n');
    } else if (parseInt(msgStats.categorized) === 0) {
      console.log('💡 Messages exist but none are categorized yet.');
      console.log('New messages after migration will be auto-categorized.\n');
    } else {
      console.log('✅ Everything looks good! Data should appear in dashboard.\n');
      console.log('If still not showing, check browser console for API errors.');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProductionStore();
