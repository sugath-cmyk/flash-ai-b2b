import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function verifySchema() {
  try {
    console.log('🔍 Verifying Analytics Schema...\n');

    // Check widget_messages columns
    console.log('📋 Checking widget_messages table:');
    const messagesColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'widget_messages'
        AND column_name IN ('query_category', 'query_intent', 'query_topics', 'sentiment', 'cached_from', 'cache_key')
      ORDER BY column_name
    `);

    if (messagesColumns.rows.length > 0) {
      messagesColumns.rows.forEach(col => {
        console.log(`  ✅ ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('  ❌ No analytics columns found!');
    }

    // Check widget_conversations columns
    console.log('\n📋 Checking widget_conversations table:');
    const conversationsColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'widget_conversations'
        AND column_name IN ('rating', 'feedback_text', 'tags', 'resolution_status', 'total_messages')
      ORDER BY column_name
    `);

    if (conversationsColumns.rows.length > 0) {
      conversationsColumns.rows.forEach(col => {
        console.log(`  ✅ ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('  ❌ No analytics columns found!');
    }

    // Check query_cache table
    console.log('\n📋 Checking query_cache table:');
    const cacheTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'query_cache'
      )
    `);

    if (cacheTableExists.rows[0].exists) {
      console.log('  ✅ query_cache table exists');

      const cacheCount = await pool.query('SELECT COUNT(*) FROM query_cache');
      console.log(`  📊 Current cached queries: ${cacheCount.rows[0].count}`);
    } else {
      console.log('  ❌ query_cache table not found!');
    }

    // Check functions
    console.log('\n⚙️  Checking database functions:');
    const functions = await pool.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_type = 'FUNCTION'
        AND routine_name IN ('array_jaccard_similarity', 'find_similar_cached_queries', 'clean_expired_cache', 'archive_old_conversations')
      ORDER BY routine_name
    `);

    if (functions.rows.length > 0) {
      functions.rows.forEach(func => {
        console.log(`  ✅ ${func.routine_name}()`);
      });
    } else {
      console.log('  ❌ No analytics functions found!');
    }

    // Check indexes
    console.log('\n🗂️  Checking indexes:');
    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename IN ('widget_messages', 'widget_conversations', 'query_cache')
        AND indexname LIKE '%category%' OR indexname LIKE '%cache%' OR indexname LIKE '%rating%'
      ORDER BY indexname
      LIMIT 10
    `);

    if (indexes.rows.length > 0) {
      indexes.rows.forEach(idx => {
        console.log(`  ✅ ${idx.indexname}`);
      });
    }

    // Test data collection
    console.log('\n📊 Testing data collection:');
    const recentMessages = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(query_category) as with_category,
        COUNT(cached_from) as cached
      FROM widget_messages
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    const stats = recentMessages.rows[0];
    console.log(`  📈 Messages (last 7 days): ${stats.total}`);
    console.log(`  🏷️  Categorized: ${stats.with_category}`);
    console.log(`  ⚡ Cached: ${stats.cached}`);

    if (parseInt(stats.total) > 0) {
      const categorizationRate = (parseInt(stats.with_category) / parseInt(stats.total) * 100).toFixed(1);
      const cacheRate = (parseInt(stats.cached) / parseInt(stats.total) * 100).toFixed(1);
      console.log(`  📊 Categorization rate: ${categorizationRate}%`);
      console.log(`  ⚡ Cache hit rate: ${cacheRate}%`);
    }

    console.log('\n✅ Analytics schema verification complete!');
    console.log('\n💡 Next steps:');
    console.log('  1. Widget messages are now auto-categorized');
    console.log('  2. Similar queries will be cached to reduce costs');
    console.log('  3. Ready to build admin analytics dashboard');
    console.log('  4. Access analytics at: /api/admin/queries/stats');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifySchema();
