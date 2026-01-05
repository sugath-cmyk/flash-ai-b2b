/**
 * Check Production Database for Store Data
 *
 * Usage:
 *   npx ts-node src/scripts/check-production-data.ts
 *
 * This script checks if:
 * 1. The store exists in production database
 * 2. There are widget_conversations for the store
 * 3. There are widget_messages for the store
 * 4. The analytics columns exist
 * 5. Sample data from the conversations
 */

import { Pool } from 'pg';

const STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

// Use DATABASE_URL from environment or default to local
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sugathsurendran@localhost:5432/flash_ai_b2b';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') || DATABASE_URL.includes('amazonaws.com')
    ? { rejectUnauthorized: false }
    : false
});

async function checkProductionData() {
  console.log('🔍 Checking Production Database for Store Data\n');
  console.log('='.repeat(70));
  console.log(`Store ID: ${STORE_ID}`);
  console.log(`Database: ${DATABASE_URL.substring(0, 50)}...`);
  console.log('='.repeat(70));
  console.log('');

  try {
    // Test 1: Check if store exists
    console.log('📊 Step 1: Checking if store exists...\n');
    const storeCheck = await pool.query(
      'SELECT id, store_name, domain, user_id, created_at FROM stores WHERE id = $1',
      [STORE_ID]
    );

    if (storeCheck.rows.length === 0) {
      console.log('❌ Store does NOT exist in this database!');
      console.log('');
      console.log('This means:');
      console.log('  - The store ID is in your frontend URL');
      console.log('  - But it doesn\'t exist in the database you\'re querying');
      console.log('  - You may be connected to the wrong database (local vs production)');
      console.log('');
      console.log('💡 Solution:');
      console.log('  Make sure DATABASE_URL in your environment points to production');
      console.log('  Render DATABASE_URL should look like:');
      console.log('  postgresql://user:pass@dpg-xxxxx.oregon-postgres.render.com/dbname');
      console.log('');

      // Show available stores for reference
      console.log('Available stores in THIS database:');
      const allStores = await pool.query('SELECT id, store_name, domain, created_at FROM stores LIMIT 5');
      allStores.rows.forEach((store, idx) => {
        console.log(`  ${idx + 1}. ${store.store_name || store.domain || 'Unnamed'}`);
        console.log(`     ID: ${store.id}`);
        console.log(`     Created: ${store.created_at}`);
        console.log('');
      });

      await pool.end();
      process.exit(1);
    }

    const store = storeCheck.rows[0];
    console.log('✅ Store EXISTS in database!');
    console.log(`   Name: ${store.store_name || 'N/A'}`);
    console.log(`   Domain: ${store.domain || 'N/A'}`);
    console.log(`   Owner ID: ${store.user_id}`);
    console.log(`   Created: ${store.created_at}`);
    console.log('');

    // Test 2: Check for widget_conversations
    console.log('📊 Step 2: Checking for widget conversations...\n');
    const conversationsCheck = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        MIN(created_at) as first_conversation,
        MAX(created_at) as last_conversation
      FROM widget_conversations
      WHERE store_id = $1`,
      [STORE_ID]
    );

    const convStats = conversationsCheck.rows[0];
    console.log(`Total Conversations: ${convStats.total}`);
    if (parseInt(convStats.total) > 0) {
      console.log(`   Active: ${convStats.active}`);
      console.log(`   Resolved: ${convStats.resolved}`);
      console.log(`   First: ${convStats.first_conversation}`);
      console.log(`   Last: ${convStats.last_conversation}`);
      console.log('   ✅ Has conversation data!');
    } else {
      console.log('   ⚠️  NO conversations found for this store');
    }
    console.log('');

    // Test 3: Check for widget_messages
    console.log('📊 Step 3: Checking for widget messages...\n');
    const messagesCheck = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE role = 'user') as user_messages,
        COUNT(*) FILTER (WHERE role = 'assistant') as assistant_messages,
        COUNT(*) FILTER (WHERE query_category IS NOT NULL) as categorized,
        SUM(tokens) as total_tokens
      FROM widget_messages
      WHERE store_id = $1`,
      [STORE_ID]
    );

    const msgStats = messagesCheck.rows[0];
    console.log(`Total Messages: ${msgStats.total}`);
    if (parseInt(msgStats.total) > 0) {
      console.log(`   User messages: ${msgStats.user_messages}`);
      console.log(`   Assistant messages: ${msgStats.assistant_messages}`);
      console.log(`   Categorized: ${msgStats.categorized}`);
      console.log(`   Total tokens: ${msgStats.total_tokens || 0}`);
      console.log('   ✅ Has message data!');
    } else {
      console.log('   ⚠️  NO messages found for this store');
    }
    console.log('');

    // Test 4: Check analytics columns
    console.log('📊 Step 4: Checking analytics schema...\n');
    const schemaCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'widget_messages'
        AND column_name IN ('query_category', 'query_intent', 'query_topics', 'cache_key')
    `);

    const foundColumns = schemaCheck.rows.map(r => r.column_name);
    const requiredColumns = ['query_category', 'query_intent', 'query_topics', 'cache_key'];

    requiredColumns.forEach(col => {
      if (foundColumns.includes(col)) {
        console.log(`   ✅ Column '${col}' exists`);
      } else {
        console.log(`   ❌ Column '${col}' MISSING`);
      }
    });

    if (foundColumns.length !== requiredColumns.length) {
      console.log('');
      console.log('⚠️  Analytics migration not applied to this database!');
      console.log('Run the migration: 010_query_analytics.sql');
    }
    console.log('');

    // Test 5: Sample conversations (if any exist)
    if (parseInt(convStats.total) > 0) {
      console.log('📊 Step 5: Sample conversations...\n');
      const sampleConvs = await pool.query(
        `SELECT
          wc.id,
          wc.session_id,
          wc.created_at,
          COUNT(wm.id) as message_count
        FROM widget_conversations wc
        LEFT JOIN widget_messages wm ON wm.conversation_id = wc.id
        WHERE wc.store_id = $1
        GROUP BY wc.id, wc.session_id, wc.created_at
        ORDER BY wc.created_at DESC
        LIMIT 3`,
        [STORE_ID]
      );

      sampleConvs.rows.forEach((conv, idx) => {
        console.log(`   ${idx + 1}. Conversation ${conv.id.substring(0, 8)}...`);
        console.log(`      Session: ${conv.session_id}`);
        console.log(`      Messages: ${conv.message_count}`);
        console.log(`      Created: ${conv.created_at}`);
        console.log('');
      });
    }

    // Test 6: Sample messages (if any exist)
    if (parseInt(msgStats.total) > 0) {
      console.log('📊 Step 6: Sample messages...\n');
      const sampleMsgs = await pool.query(
        `SELECT
          role,
          content,
          query_category,
          created_at
        FROM widget_messages
        WHERE store_id = $1
          AND role = 'user'
        ORDER BY created_at DESC
        LIMIT 3`,
        [STORE_ID]
      );

      sampleMsgs.rows.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. "${msg.content.substring(0, 60)}..."`);
        console.log(`      Category: ${msg.query_category || 'uncategorized'}`);
        console.log(`      Time: ${msg.created_at}`);
        console.log('');
      });
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📊 SUMMARY\n');

    if (parseInt(convStats.total) === 0) {
      console.log('❌ NO DATA: Store exists but has no conversations yet\n');
      console.log('Why the analytics dashboard shows "No data found":\n');
      console.log('  - The store is created and exists ✅');
      console.log('  - But no one has used the widget yet ℹ️');
      console.log('  - Analytics APIs return empty arrays (correct behavior) ✅\n');
      console.log('💡 HOW TO FIX:\n');
      console.log('1. Make sure your widget is installed on your website');
      console.log('2. Visit a product page where the widget is installed');
      console.log('3. Chat with the widget (ask it questions)');
      console.log('4. Check the analytics dashboard again\n');
      console.log('The widget script URL should be:');
      console.log(`   https://flash-ai-backend-rld7.onrender.com/widget/${STORE_ID}.js\n`);
    } else {
      console.log('✅ DATA EXISTS: Store has conversations and messages!\n');
      console.log('If the dashboard still shows "no data", possible causes:\n');
      console.log('  1. Frontend not authenticated properly (check JWT token)');
      console.log('  2. Frontend calling wrong API endpoints');
      console.log('  3. CORS issues blocking API responses');
      console.log('  4. Check browser DevTools Console for errors\n');
    }

    await pool.end();
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

checkProductionData();
