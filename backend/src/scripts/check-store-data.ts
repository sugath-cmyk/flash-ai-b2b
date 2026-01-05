import axios from 'axios';
import * as readline from 'readline';

const BASE_URL = 'https://flash-ai-backend-rld7.onrender.com/api';
const STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function checkStoreData() {
  console.log('🔍 Checking Production Store Data\n');
  console.log('='.repeat(70));
  console.log(`Store ID: ${STORE_ID}`);
  console.log(`Backend: ${BASE_URL}\n`);

  // Ask for auth token
  console.log('To test with authentication, we need your JWT token.');
  console.log('Open your browser, go to DevTools Console, and run:');
  console.log('  localStorage.getItem("access_token")\n');

  const token = await question('Paste your access_token here (or press Enter to skip): ');
  console.log();

  if (!token.trim()) {
    console.log('⚠️  Skipping authenticated tests (no token provided)\n');
    rl.close();
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token.trim()}`
  };

  try {
    // Test 1: Check conversations
    console.log('📡 Step 1: Checking conversations...\n');
    try {
      const conversations = await axios.get(
        `${BASE_URL}/brand/${STORE_ID}/conversations`,
        { headers, validateStatus: () => true }
      );

      console.log(`   Status: ${conversations.status}`);

      if (conversations.status === 200) {
        const convData = conversations.data.data || [];
        console.log(`   ✅ Success! Found ${convData.length} conversations`);

        if (convData.length > 0) {
          console.log(`\n   Recent conversations:`);
          convData.slice(0, 3).forEach((conv: any, idx: number) => {
            console.log(`   ${idx + 1}. Session: ${conv.session_id}`);
            console.log(`      Messages: ${conv.message_count || 0}`);
            console.log(`      Created: ${conv.created_at}`);
          });
        } else {
          console.log(`   ℹ️  No conversations found for this store yet.`);
        }
      } else if (conversations.status === 401) {
        console.log(`   ❌ Authentication failed - token may be invalid or expired`);
        console.log(`   Try getting a fresh token from localStorage`);
        rl.close();
        return;
      } else if (conversations.status === 404) {
        console.log(`   ❌ Store not found or endpoint doesn't exist`);
      } else {
        console.log(`   ⚠️  Status: ${conversations.status}`);
        console.log(`   Message: ${conversations.data.message || 'Unknown'}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 2: Check query analytics stats
    console.log('\n📡 Step 2: Checking query analytics stats...\n');
    try {
      const stats = await axios.get(
        `${BASE_URL}/brand/${STORE_ID}/query-analytics/stats`,
        {
          headers,
          params: { days: 30 },
          validateStatus: () => true
        }
      );

      console.log(`   Status: ${stats.status}`);

      if (stats.status === 200) {
        const statsData = stats.data.data;
        console.log(`   ✅ Success!`);
        console.log(`   Total Queries: ${statsData?.totalQueries || 0}`);
        console.log(`   Conversations: ${statsData?.uniqueConversations || 0}`);
        console.log(`   Cache Hit Rate: ${(statsData?.cacheHitRate || 0) * 100}%`);
        console.log(`   Avg Tokens: ${statsData?.avgTokensPerQuery || 0}`);
      } else if (stats.status === 401) {
        console.log(`   ❌ Authentication failed`);
      } else if (stats.status === 404) {
        console.log(`   ❌ Endpoint not found`);
      } else {
        console.log(`   ⚠️  Status: ${stats.status}`);
        console.log(`   Response: ${JSON.stringify(stats.data).substring(0, 200)}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 3: Check popular queries
    console.log('\n📡 Step 3: Checking popular queries...\n');
    try {
      const popular = await axios.get(
        `${BASE_URL}/brand/${STORE_ID}/query-analytics/popular`,
        {
          headers,
          params: { days: 30, limit: 5 },
          validateStatus: () => true
        }
      );

      console.log(`   Status: ${popular.status}`);

      if (popular.status === 200) {
        const queries = popular.data.data?.popularQueries || [];
        console.log(`   ✅ Success! Found ${queries.length} popular queries`);

        if (queries.length > 0) {
          console.log(`\n   Top queries:`);
          queries.forEach((q: any, idx: number) => {
            console.log(`   ${idx + 1}. "${q.query}" (${q.count} times)`);
            console.log(`      Category: ${q.category || 'N/A'}`);
          });
        } else {
          console.log(`   ℹ️  No queries found yet.`);
        }
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 CONCLUSION:\n');
    console.log('If you see "0 conversations" or "0 queries" above, your store exists');
    console.log('but has no data yet. To generate analytics data:\n');
    console.log('1. Make sure your widget is installed on your Shopify store');
    console.log('2. Visit a product page on your store');
    console.log('3. Chat with the widget (ask questions about products)');
    console.log('4. The analytics will populate automatically\n');
    console.log('Widget install code: https://flash-ai-b2b.vercel.app/brand/' + STORE_ID + '/dashboard');
    console.log('(Go to "Widget" tab to get the installation code)\n');

    rl.close();
  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    rl.close();
    process.exit(1);
  }
}

checkStoreData();
