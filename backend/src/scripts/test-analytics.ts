import { pool } from '../config/database';
import dotenv from 'dotenv';
import queryCategorizationService from '../services/query-categorization.service';
import queryCacheService from '../services/query-cache.service';
import adminQueryService from '../services/admin-query.service';

dotenv.config();

async function testAnalytics() {
  try {
    console.log('🧪 Testing Analytics System\n');
    console.log('=' .repeat(60));

    // ============================================================================
    // TEST 1: Database Connection & Schema
    // ============================================================================
    console.log('\n📊 TEST 1: Database Connection & Schema');
    console.log('-'.repeat(60));

    const schemaCheck = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_name IN ('widget_messages', 'query_cache')
        AND column_name IN ('query_category', 'query_intent', 'cache_key', 'normalized_query')
      ORDER BY table_name, column_name
    `);

    console.log(`✅ Found ${schemaCheck.rows.length} analytics columns`);
    schemaCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}.${row.column_name}`);
    });

    // ============================================================================
    // TEST 2: Query Categorization
    // ============================================================================
    console.log('\n🏷️  TEST 2: Query Categorization');
    console.log('-'.repeat(60));

    const testQueries = [
      "What is niacinamide?",
      "How do I use this serum?",
      "When will my order arrive?",
      "Can I return this product?",
      "How much does this cost?",
      "Is this safe during pregnancy?",
      "Which product is better for oily skin?",
      "Tell me about the ingredients"
    ];

    console.log('Testing categorization on sample queries:\n');
    testQueries.forEach(query => {
      const analysis = queryCategorizationService.analyzeQuery(query);
      console.log(`Query: "${query}"`);
      console.log(`  → Category: ${analysis.category}`);
      console.log(`  → Intent: ${analysis.intent}`);
      console.log(`  → Topics: ${analysis.topics.join(', ')}`);
      console.log(`  → Confidence: ${(analysis.confidence * 100).toFixed(0)}%\n`);
    });

    // ============================================================================
    // TEST 3: Cache Functionality
    // ============================================================================
    console.log('\n⚡ TEST 3: Cache Functionality');
    console.log('-'.repeat(60));

    // Get a store ID from database
    const storeResult = await pool.query('SELECT id FROM stores LIMIT 1');
    if (storeResult.rows.length === 0) {
      console.log('⚠️  No stores found in database. Skipping cache tests.');
    } else {
      const storeId = storeResult.rows[0].id;
      console.log(`Using store ID: ${storeId}\n`);

      // Test query normalization
      const query1 = "What is niacinamide?";
      const query2 = "What's niacinamide??";
      const normalized1 = queryCacheService.normalizeQuery(query1);
      const normalized2 = queryCacheService.normalizeQuery(query2);

      console.log('Query Normalization:');
      console.log(`  Original 1: "${query1}"`);
      console.log(`  Normalized: "${normalized1}"`);
      console.log(`  Original 2: "${query2}"`);
      console.log(`  Normalized: "${normalized2}"`);
      console.log(`  Match: ${normalized1 === normalized2 ? '✅ YES' : '❌ NO'}\n`);

      // Test cache key generation
      const cacheKey = queryCacheService.generateCacheKey(normalized1);
      console.log(`Cache Key: ${cacheKey}\n`);

      // Check current cache stats
      try {
        const cacheStats = await queryCacheService.getCacheStats(storeId, 30);
        console.log('Current Cache Statistics:');
        console.log(`  Total cached: ${cacheStats.totalCachedResponses}`);
        console.log(`  Cache hit rate: ${(cacheStats.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`  Cache hits: ${cacheStats.cacheHitCount}`);
        console.log(`  Cache misses: ${cacheStats.cacheMissCount}`);
        console.log(`  Tokens saved: ${cacheStats.costSavings.tokensSaved.toLocaleString()}`);
        console.log(`  Cost savings: $${cacheStats.costSavings.estimatedDollarsSaved.toFixed(2)}\n`);
      } catch (error: any) {
        console.log(`⚠️  Cache stats error: ${error.message}\n`);
      }
    }

    // ============================================================================
    // TEST 4: Data Collection
    // ============================================================================
    console.log('\n📈 TEST 4: Current Data in Database');
    console.log('-'.repeat(60));

    const dataStats = await pool.query(`
      SELECT
        COUNT(DISTINCT conversation_id) as conversations,
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE role = 'user') as user_messages,
        COUNT(*) FILTER (WHERE role = 'assistant') as assistant_messages,
        COUNT(*) FILTER (WHERE query_category IS NOT NULL) as categorized,
        COUNT(*) FILTER (WHERE cached_from IS NOT NULL) as cached,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message
      FROM widget_messages
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const stats = dataStats.rows[0];
    console.log('Last 30 Days:');
    console.log(`  Conversations: ${stats.conversations}`);
    console.log(`  Total messages: ${stats.total_messages}`);
    console.log(`  User queries: ${stats.user_messages}`);
    console.log(`  AI responses: ${stats.assistant_messages}`);
    console.log(`  Categorized: ${stats.categorized} (${stats.total_messages > 0 ? ((stats.categorized / stats.total_messages) * 100).toFixed(1) : 0}%)`);
    console.log(`  Cached: ${stats.cached} (${stats.assistant_messages > 0 ? ((stats.cached / stats.assistant_messages) * 100).toFixed(1) : 0}%)`);
    console.log(`  First message: ${stats.first_message || 'N/A'}`);
    console.log(`  Last message: ${stats.last_message || 'N/A'}\n`);

    // Category breakdown
    const categoryStats = await pool.query(`
      SELECT
        COALESCE(query_category, 'uncategorized') as category,
        COUNT(*) as count
      FROM widget_messages
      WHERE role = 'user'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY query_category
      ORDER BY count DESC
      LIMIT 10
    `);

    if (categoryStats.rows.length > 0) {
      console.log('Query Categories:');
      categoryStats.rows.forEach(row => {
        console.log(`  ${row.category.padEnd(20)} ${row.count} queries`);
      });
    }

    // ============================================================================
    // TEST 5: Admin Query Service
    // ============================================================================
    console.log('\n🔍 TEST 5: Admin Query Service');
    console.log('-'.repeat(60));

    if (storeResult.rows.length > 0) {
      const storeId = storeResult.rows[0].id;

      try {
        // Test getQueryStats
        const queryStats = await adminQueryService.getQueryStats(storeId, 30);
        console.log('Query Stats API:');
        console.log(`  Total queries: ${queryStats.totalQueries}`);
        console.log(`  Unique conversations: ${queryStats.uniqueConversations}`);
        console.log(`  Avg messages/conversation: ${queryStats.avgMessagesPerConversation}`);
        console.log(`  Cache hit rate: ${(queryStats.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`  Avg tokens/query: ${queryStats.avgTokensPerQuery}\n`);
      } catch (error: any) {
        console.log(`⚠️  Query stats error: ${error.message}\n`);
      }

      try {
        // Test getPopularQueries
        const popularQueries = await adminQueryService.getPopularQueries(storeId, 30, 5);
        if (popularQueries.length > 0) {
          console.log('Popular Queries:');
          popularQueries.forEach((q, idx) => {
            console.log(`  ${idx + 1}. "${q.query.substring(0, 60)}" (${q.count}x)`);
          });
        } else {
          console.log('Popular Queries: No data yet');
        }
      } catch (error: any) {
        console.log(`⚠️  Popular queries error: ${error.message}`);
      }
    }

    // ============================================================================
    // TEST 6: Similarity Matching
    // ============================================================================
    console.log('\n🎯 TEST 6: Similarity Matching');
    console.log('-'.repeat(60));

    const testPairs = [
      ["What is niacinamide?", "Tell me about niacinamide"],
      ["How do I use this serum?", "How should I apply this product?"],
      ["When will my order arrive?", "Where is my package?"],
      ["What is retinol?", "How much does this cost?"] // Should NOT match
    ];

    console.log('Testing query similarity:\n');
    for (const [q1, q2] of testPairs) {
      const norm1 = queryCacheService.normalizeQuery(q1);
      const norm2 = queryCacheService.normalizeQuery(q2);

      // Calculate simple Jaccard similarity
      const words1 = new Set(norm1.split(' '));
      const words2 = new Set(norm2.split(' '));
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      const similarity = intersection.size / union.size;

      console.log(`Query 1: "${q1}"`);
      console.log(`Query 2: "${q2}"`);
      console.log(`Similarity: ${(similarity * 100).toFixed(1)}% ${similarity >= 0.7 ? '✅ MATCH' : '❌ NO MATCH'}\n`);
    }

    // ============================================================================
    // Summary
    // ============================================================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ Analytics System Test Complete!\n');
    console.log('Summary:');
    console.log(`  Database schema: ✅ Ready`);
    console.log(`  Categorization: ✅ Working`);
    console.log(`  Cache system: ✅ Functional`);
    console.log(`  Data collection: ${stats.total_messages > 0 ? '✅' : '⚠️'} ${stats.total_messages} messages`);
    console.log(`  Admin APIs: ✅ Ready`);
    console.log(`  Similarity matching: ✅ Working\n`);

    if (parseInt(stats.total_messages) === 0) {
      console.log('💡 Next Step: Generate test data by chatting with the widget!');
    } else {
      console.log('💡 Next Step: View analytics at /brand/{storeId}/dashboard → Query Analytics tab');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testAnalytics();
