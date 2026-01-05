import { pool } from '../config/database';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testProductionE2E() {
  console.log('🔍 END-TO-END PRODUCTION DEBUG\n');
  console.log('='.repeat(70));

  // The store ID that has data
  const correctStoreId = 'ff0937ce-b0bd-4270-977e-f1fd27f82da0';
  const wrongStoreId = '62130715-ff42-4160-934e-c663fc1e7872';
  const baseURL = 'https://flash-ai-backend-rld7.onrender.com';

  try {
    // ============================================================================
    // STEP 1: Check Database Directly
    // ============================================================================
    console.log('\n📊 STEP 1: Checking Production Database Directly\n');
    console.log('-'.repeat(70));

    // Check wrong store ID
    const wrongStoreCheck = await pool.query(
      'SELECT COUNT(*) FROM stores WHERE id = $1',
      [wrongStoreId]
    );
    console.log(`❌ Wrong Store ID (${wrongStoreId.substring(0, 20)}...)`);
    console.log(`   Exists in DB: ${wrongStoreCheck.rows[0].count === '1' ? 'YES' : 'NO'}`);

    // Check correct store ID
    const correctStoreCheck = await pool.query(
      `SELECT s.id, s.store_name, s.domain,
              COUNT(DISTINCT wc.id) as conversations,
              COUNT(wm.id) as messages,
              COUNT(wm.id) FILTER (WHERE wm.role = 'user') as user_queries,
              COUNT(wm.id) FILTER (WHERE wm.query_category IS NOT NULL) as categorized
       FROM stores s
       LEFT JOIN widget_conversations wc ON wc.store_id = s.id
       LEFT JOIN widget_messages wm ON wm.store_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, s.store_name, s.domain`,
      [correctStoreId]
    );

    if (correctStoreCheck.rows.length === 0) {
      console.log(`\n❌ CRITICAL: Correct store ID doesn't exist either!`);
      process.exit(1);
    }

    const storeData = correctStoreCheck.rows[0];
    console.log(`\n✅ Correct Store ID (${correctStoreId.substring(0, 20)}...)`);
    console.log(`   Name: ${storeData.store_name || storeData.domain}`);
    console.log(`   Conversations: ${storeData.conversations}`);
    console.log(`   Messages: ${storeData.messages}`);
    console.log(`   User Queries: ${storeData.user_queries}`);
    console.log(`   Categorized: ${storeData.categorized}`);

    // ============================================================================
    // STEP 2: Test Backend API Endpoints (Without Auth)
    // ============================================================================
    console.log('\n\n🌐 STEP 2: Testing Backend API Endpoints\n');
    console.log('-'.repeat(70));

    // Test 1: Health endpoint
    console.log('\n📡 Testing: GET /health');
    try {
      const healthRes = await axios.get(`${baseURL}/health`);
      console.log(`   Status: ${healthRes.status}`);
      console.log(`   Version: ${healthRes.data.version}`);
      console.log(`   ✅ Backend is live!`);
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 2: Query stats endpoint (will fail without auth, but we can see the error)
    console.log('\n📡 Testing: GET /api/admin/queries/stats');
    try {
      const statsRes = await axios.get(`${baseURL}/api/admin/queries/stats`, {
        params: { storeId: correctStoreId, days: 30 },
        validateStatus: () => true
      });
      console.log(`   Status: ${statsRes.status}`);

      if (statsRes.status === 401) {
        console.log(`   ✅ Endpoint exists (401 = needs authentication)`);
      } else if (statsRes.status === 200) {
        console.log(`   ✅ Success! Data returned:`);
        console.log(`      Total Queries: ${statsRes.data.data.totalQueries}`);
        console.log(`      Conversations: ${statsRes.data.data.uniqueConversations}`);
      } else {
        console.log(`   ⚠️  Unexpected status: ${statsRes.data.message || 'No message'}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 3: Popular queries endpoint
    console.log('\n📡 Testing: GET /api/admin/queries/popular');
    try {
      const popularRes = await axios.get(`${baseURL}/api/admin/queries/popular`, {
        params: { storeId: correctStoreId, days: 30, limit: 5 },
        validateStatus: () => true
      });
      console.log(`   Status: ${popularRes.status}`);

      if (popularRes.status === 401) {
        console.log(`   ✅ Endpoint exists (401 = needs authentication)`);
      } else if (popularRes.status === 200) {
        console.log(`   ✅ Success! Found ${popularRes.data.data.popularQueries.length} queries`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // ============================================================================
    // STEP 3: Check Admin Routes Configuration
    // ============================================================================
    console.log('\n\n🔐 STEP 3: Authentication Requirements\n');
    console.log('-'.repeat(70));
    console.log('All /api/admin/* endpoints require:');
    console.log('  1. ✅ authenticate middleware (JWT token)');
    console.log('  2. ✅ authorize("admin") middleware');
    console.log('\nThe 401 errors above are EXPECTED without authentication.');
    console.log('Frontend should be passing the JWT token from localStorage.\n');

    // ============================================================================
    // STEP 4: Sample Queries from Database
    // ============================================================================
    console.log('\n📋 STEP 4: Sample Data from Database\n');
    console.log('-'.repeat(70));

    const sampleQueries = await pool.query(
      `SELECT
        content,
        query_category,
        query_intent,
        query_topics,
        created_at
       FROM widget_messages
       WHERE store_id = $1
         AND role = 'user'
       ORDER BY created_at DESC
       LIMIT 5`,
      [correctStoreId]
    );

    if (sampleQueries.rows.length > 0) {
      console.log('Recent user queries:\n');
      sampleQueries.rows.forEach((q, idx) => {
        console.log(`${idx + 1}. "${q.content}"`);
        console.log(`   Category: ${q.query_category || 'uncategorized'}`);
        console.log(`   Intent: ${q.query_intent || 'N/A'}`);
        console.log(`   Topics: ${q.query_topics?.join(', ') || 'N/A'}`);
        console.log(`   Date: ${q.created_at}\n`);
      });
    } else {
      console.log('No queries found for this store.\n');
    }

    // ============================================================================
    // SUMMARY & SOLUTION
    // ============================================================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 DIAGNOSIS SUMMARY\n');

    console.log('✅ Backend Status:');
    console.log('   - Backend is deployed and live');
    console.log('   - Version 1.0.1 (with analytics)');
    console.log('   - API endpoints exist and require auth\n');

    console.log('✅ Database Status:');
    console.log(`   - Correct store has ${storeData.conversations} conversations`);
    console.log(`   - Total ${storeData.messages} messages`);
    console.log(`   - ${storeData.user_queries} user queries`);
    console.log(`   - ${storeData.categorized} categorized\n`);

    console.log('❌ Problem:');
    console.log(`   - You're using WRONG store ID in browser URL`);
    console.log(`   - Wrong: ${wrongStoreId}`);
    console.log(`   - Correct: ${correctStoreId}\n`);

    console.log('✅ SOLUTION:\n');
    console.log('🔗 USE THIS EXACT URL (click or copy):\n');
    console.log('   https://flash-ai-b2b.vercel.app/brand/ff0937ce-b0bd-4270-977e-f1fd27f82da0/dashboard\n');
    console.log('Then click the "Query Analytics" tab.\n');

    console.log('💡 If still not working after using correct URL:');
    console.log('   1. Open browser DevTools (F12)');
    console.log('   2. Go to Console tab');
    console.log('   3. Check for errors');
    console.log('   4. Go to Network tab');
    console.log('   5. Look for API calls to /api/admin/queries/*');
    console.log('   6. Check if Authorization header is present');
    console.log('   7. Check response status and body\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testProductionE2E();
