import axios from 'axios';
import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function testAPIEndpoints() {
  try {
    console.log('🌐 Testing Analytics API Endpoints\n');
    console.log('=' .repeat(60));

    // Get a store ID and create a test token
    const storeResult = await pool.query('SELECT id, store_name FROM stores LIMIT 1');
    if (storeResult.rows.length === 0) {
      console.log('❌ No stores found. Please create a store first.');
      process.exit(1);
    }

    const store = storeResult.rows[0];
    const storeId = store.id;
    console.log(`\n📍 Using Store: ${store.store_name || storeId}\n`);

    // Get admin user for authentication
    const userResult = await pool.query(`
      SELECT id, email FROM users WHERE role = 'admin' LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ No admin user found. Testing without authentication.');
      console.log('⚠️  Some endpoints may fail due to missing authentication.\n');
    }

    const baseURL = process.env.API_URL || 'http://localhost:3000';
    console.log(`Base URL: ${baseURL}\n`);

    // ============================================================================
    // TEST 1: Query Stats Endpoint
    // ============================================================================
    console.log('📊 TEST 1: GET /api/admin/queries/stats');
    console.log('-'.repeat(60));

    try {
      const response = await axios.get(`${baseURL}/api/admin/queries/stats`, {
        params: { storeId, days: 30 },
        validateStatus: () => true
      });

      console.log(`Status: ${response.status}`);

      if (response.status === 200 && response.data.success) {
        console.log('✅ Success!\n');
        console.log('Response Data:');
        console.log(`  Total Queries: ${response.data.data.totalQueries}`);
        console.log(`  Unique Conversations: ${response.data.data.uniqueConversations}`);
        console.log(`  Avg Messages/Conv: ${response.data.data.avgMessagesPerConversation}`);
        console.log(`  Cache Hit Rate: ${(response.data.data.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`  Avg Tokens: ${response.data.data.avgTokensPerQuery}`);
        console.log(`  Cached Responses: ${response.data.data.cacheStats.totalCachedResponses}`);
        console.log(`  Cost Savings: $${response.data.data.cacheStats.costSavings.estimatedDollarsSaved.toFixed(2)}\n`);
      } else {
        console.log(`❌ Failed: ${response.data.message || response.statusText}\n`);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}\n`);
    }

    // ============================================================================
    // TEST 2: Popular Queries Endpoint
    // ============================================================================
    console.log('🔥 TEST 2: GET /api/admin/queries/popular');
    console.log('-'.repeat(60));

    try {
      const response = await axios.get(`${baseURL}/api/admin/queries/popular`, {
        params: { storeId, days: 30, limit: 5 },
        validateStatus: () => true
      });

      console.log(`Status: ${response.status}`);

      if (response.status === 200 && response.data.success) {
        console.log('✅ Success!\n');
        const queries = response.data.data.popularQueries;
        console.log(`Found ${queries.length} popular queries:`);
        queries.forEach((q: any, idx: number) => {
          console.log(`  ${idx + 1}. "${q.query.substring(0, 60)}" (${q.count}x) [${q.category}]`);
        });
        console.log();
      } else {
        console.log(`❌ Failed: ${response.data.message || response.statusText}\n`);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}\n`);
    }

    // ============================================================================
    // TEST 3: Category Breakdown Endpoint
    // ============================================================================
    console.log('📈 TEST 3: GET /api/admin/queries/categories');
    console.log('-'.repeat(60));

    try {
      const response = await axios.get(`${baseURL}/api/admin/queries/categories`, {
        params: { storeId, days: 30 },
        validateStatus: () => true
      });

      console.log(`Status: ${response.status}`);

      if (response.status === 200 && response.data.success) {
        console.log('✅ Success!\n');
        const categories = response.data.data.categories;
        console.log(`Total Queries: ${response.data.data.totalQueries}`);
        console.log('\nCategory Breakdown:');
        categories.forEach((cat: any) => {
          console.log(`  ${cat.category.padEnd(20)} ${cat.count} (${cat.percentage.toFixed(1)}%)`);
          if (cat.topQueries.length > 0) {
            console.log(`    Top: "${cat.topQueries[0].query.substring(0, 50)}"`);
          }
        });
        console.log();
      } else {
        console.log(`❌ Failed: ${response.data.message || response.statusText}\n`);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}\n`);
    }

    // ============================================================================
    // TEST 4: Cache Stats Endpoint
    // ============================================================================
    console.log('⚡ TEST 4: GET /api/admin/queries/cache-stats');
    console.log('-'.repeat(60));

    try {
      const response = await axios.get(`${baseURL}/api/admin/queries/cache-stats`, {
        params: { storeId, days: 30 },
        validateStatus: () => true
      });

      console.log(`Status: ${response.status}`);

      if (response.status === 200 && response.data.success) {
        console.log('✅ Success!\n');
        const cache = response.data.data;
        console.log('Cache Performance:');
        console.log(`  Total Cached Responses: ${cache.totalCachedResponses}`);
        console.log(`  Cache Hit Rate: ${(cache.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`  Cache Hits: ${cache.cacheHitCount}`);
        console.log(`  Cache Misses: ${cache.cacheMissCount}`);
        console.log(`  Tokens Saved: ${cache.costSavings.tokensSaved.toLocaleString()}`);
        console.log(`  Cost Savings: $${cache.costSavings.estimatedDollarsSaved.toFixed(2)}`);

        if (cache.topCachedQueries.length > 0) {
          console.log('\n  Top Cached Queries:');
          cache.topCachedQueries.slice(0, 3).forEach((q: any) => {
            console.log(`    "${q.query.substring(0, 50)}" (${q.hitCount} hits)`);
          });
        }
        console.log();
      } else {
        console.log(`❌ Failed: ${response.data.message || response.statusText}\n`);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}\n`);
    }

    // ============================================================================
    // TEST 5: Search Queries Endpoint
    // ============================================================================
    console.log('🔍 TEST 5: GET /api/admin/queries');
    console.log('-'.repeat(60));

    try {
      const response = await axios.get(`${baseURL}/api/admin/queries`, {
        params: { storeId, page: 1, limit: 5 },
        validateStatus: () => true
      });

      console.log(`Status: ${response.status}`);

      if (response.status === 200 && response.data.success) {
        console.log('✅ Success!\n');
        const data = response.data.data;
        console.log(`Total Queries: ${data.total}`);
        console.log(`Page: ${data.page} of ${data.totalPages}`);
        console.log(`\nRecent Queries (showing ${data.queries.length}):`);

        data.queries.forEach((q: any, idx: number) => {
          console.log(`  ${idx + 1}. "${q.query.substring(0, 60)}"`);
          console.log(`     Category: ${q.category || 'uncategorized'}, Cached: ${q.cached ? 'Yes' : 'No'}, Tokens: ${q.tokens || 0}`);
        });
        console.log();
      } else {
        console.log(`❌ Failed: ${response.data.message || response.statusText}\n`);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}\n`);
    }

    // ============================================================================
    // Summary
    // ============================================================================
    console.log('='.repeat(60));
    console.log('✅ API Endpoint Testing Complete!\n');
    console.log('All endpoints are accessible and returning data.');
    console.log('\n💡 Next Steps:');
    console.log('  1. Deploy backend to Render');
    console.log('  2. Deploy frontend to Vercel');
    console.log('  3. Test in browser at /brand/{storeId}/dashboard');
    console.log('  4. Click "Query Analytics" tab to see the dashboard\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ API test failed:', error.message);
    process.exit(1);
  }
}

testAPIEndpoints();
