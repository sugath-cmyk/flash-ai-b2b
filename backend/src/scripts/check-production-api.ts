import axios from 'axios';

const BASE_URL = 'https://flash-ai-backend-rld7.onrender.com';
const STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

async function checkProductionAPI() {
  console.log('🔍 Checking Production API for Store\n');
  console.log('='.repeat(70));
  console.log(`Store ID: ${STORE_ID}`);
  console.log(`Backend: ${BASE_URL}\n`);

  try {
    // Test 1: Check if backend is alive
    console.log('📡 Step 1: Testing backend health...\n');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log(`✅ Backend is live!`);
    console.log(`   Status: ${health.data.status}`);
    console.log(`   Version: ${health.data.version}\n`);

    // Test 2: Check conversations endpoint (without auth - will get 401 but we can see structure)
    console.log('📡 Step 2: Testing conversations endpoint...\n');
    try {
      const conversations = await axios.get(
        `${BASE_URL}/brand/${STORE_ID}/conversations`,
        { validateStatus: () => true }
      );

      console.log(`   Status: ${conversations.status}`);

      if (conversations.status === 200) {
        console.log(`   ✅ Success! Found ${conversations.data.data?.length || 0} conversations`);
        if (conversations.data.data?.length > 0) {
          console.log(`\n   Recent conversations:`);
          conversations.data.data.slice(0, 3).forEach((conv: any, idx: number) => {
            console.log(`   ${idx + 1}. Session: ${conv.session_id}`);
            console.log(`      Messages: ${conv.message_count}`);
            console.log(`      Last: ${conv.last_message?.substring(0, 50)}...`);
          });
        }
      } else if (conversations.status === 401) {
        console.log(`   ⚠️  Requires authentication (expected)`);
      } else if (conversations.status === 404) {
        console.log(`   ❌ Endpoint not found or store doesn't exist`);
      } else {
        console.log(`   ⚠️  Status: ${conversations.status}`);
        console.log(`   Message: ${conversations.data.message || 'Unknown'}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 3: Check analytics stats endpoint (without auth)
    console.log('\n📡 Step 3: Testing analytics stats endpoint...\n');
    try {
      const stats = await axios.get(
        `${BASE_URL}/api/admin/queries/stats`,
        {
          params: { storeId: STORE_ID, days: 30 },
          validateStatus: () => true
        }
      );

      console.log(`   Status: ${stats.status}`);

      if (stats.status === 200) {
        console.log(`   ✅ Success!`);
        console.log(`   Total Queries: ${stats.data.data?.totalQueries || 0}`);
        console.log(`   Conversations: ${stats.data.data?.uniqueConversations || 0}`);
        console.log(`   Categories: ${stats.data.data?.categoryBreakdown?.length || 0}`);
      } else if (stats.status === 401) {
        console.log(`   ⚠️  Requires authentication (expected)`);
      } else if (stats.status === 404) {
        console.log(`   ❌ Endpoint not found`);
      } else {
        console.log(`   ⚠️  Status: ${stats.status}`);
        console.log(`   Message: ${stats.data.message || 'Unknown'}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 4: Check popular queries endpoint (without auth)
    console.log('\n📡 Step 4: Testing popular queries endpoint...\n');
    try {
      const popular = await axios.get(
        `${BASE_URL}/api/admin/queries/popular`,
        {
          params: { storeId: STORE_ID, days: 30, limit: 5 },
          validateStatus: () => true
        }
      );

      console.log(`   Status: ${popular.status}`);

      if (popular.status === 200) {
        console.log(`   ✅ Success!`);
        console.log(`   Found ${popular.data.data?.popularQueries?.length || 0} popular queries`);
        if (popular.data.data?.popularQueries?.length > 0) {
          console.log(`\n   Top queries:`);
          popular.data.data.popularQueries.slice(0, 3).forEach((q: any, idx: number) => {
            console.log(`   ${idx + 1}. "${q.query}" (${q.count} times)`);
          });
        }
      } else if (popular.status === 401) {
        console.log(`   ⚠️  Requires authentication (expected)`);
      } else {
        console.log(`   ⚠️  Status: ${popular.status}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 DIAGNOSIS:\n');
    console.log('If you see 401 errors above, that\'s EXPECTED (authentication required).');
    console.log('If you see 200 with data, your store has conversations!');
    console.log('If you see 200 with 0 results, your store exists but has no data yet.\n');
    console.log('💡 NEXT STEPS:\n');
    console.log('1. To generate data: Visit your product page and chat with the widget');
    console.log('2. The analytics will populate automatically as conversations happen');
    console.log('3. Check if widget is installed correctly on your store\n');

  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

checkProductionAPI();
