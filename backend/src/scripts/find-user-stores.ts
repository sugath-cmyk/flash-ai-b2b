import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function findUserStores() {
  try {
    console.log('🔍 Finding Your Store in Production\n');
    console.log('='.repeat(70));

    const storeIdFromURL = '62130715-ff42-4160-934e-c663fc1e7872';

    // Check if this store exists in production
    const storeCheck = await pool.query(
      'SELECT * FROM stores WHERE id = $1',
      [storeIdFromURL]
    );

    console.log(`\n📍 Store from your URL: ${storeIdFromURL}`);

    if (storeCheck.rows.length === 0) {
      console.log('❌ This store does NOT exist in production database.\n');
      console.log('This store might be:');
      console.log('  1. Created in your local database only');
      console.log('  2. Not yet created in production');
      console.log('  3. Created under a different ID\n');
    } else {
      console.log('✅ Store exists!\n');
      const store = storeCheck.rows[0];
      console.log(`Store Details:`);
      console.log(`  Name: ${store.store_name}`);
      console.log(`  Domain: ${store.domain}`);
      console.log(`  Created: ${store.created_at}`);
      console.log(`  Created By User: ${store.user_id}\n`);
    }

    // Find stores with similar name "Zoroh"
    console.log('\n🔎 Looking for "Zoroh" stores in production:\n');
    const zorohStores = await pool.query(`
      SELECT
        s.id,
        s.store_name,
        s.domain,
        s.user_id,
        s.created_at,
        u.email as owner_email,
        COUNT(DISTINCT wc.id) as conversations,
        COUNT(wm.id) as messages
      FROM stores s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN widget_conversations wc ON wc.store_id = s.id
      LEFT JOIN widget_messages wm ON wm.store_id = s.id
      WHERE s.store_name ILIKE '%zoroh%' OR s.domain ILIKE '%zoroh%'
      GROUP BY s.id, s.store_name, s.domain, s.user_id, s.created_at, u.email
      ORDER BY s.created_at DESC
    `);

    if (zorohStores.rows.length === 0) {
      console.log('❌ No "Zoroh" stores found in production.\n');
    } else {
      console.log(`Found ${zorohStores.rows.length} Zoroh store(s):\n`);

      zorohStores.rows.forEach((store, idx) => {
        console.log(`${idx + 1}. ${store.store_name || store.domain}`);
        console.log(`   ID: ${store.id}`);
        console.log(`   Owner: ${store.owner_email || 'Unknown'}`);
        console.log(`   Created: ${store.created_at}`);
        console.log(`   Conversations: ${store.conversations}`);
        console.log(`   Messages: ${store.messages}`);
        console.log(`   URL: https://flash-ai-b2b.vercel.app/brand/${store.id}/dashboard\n`);
      });
    }

    // Show ALL stores in production for reference
    console.log('\n📋 All Stores in Production Database:\n');
    const allStores = await pool.query(`
      SELECT
        s.id,
        s.store_name,
        s.domain,
        s.user_id,
        u.email as owner_email,
        s.created_at,
        COUNT(DISTINCT wc.id) as conversations,
        COUNT(wm.id) as messages
      FROM stores s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN widget_conversations wc ON wc.store_id = s.id
      LEFT JOIN widget_messages wm ON wm.store_id = s.id
      GROUP BY s.id, s.store_name, s.domain, s.user_id, u.email, s.created_at
      ORDER BY s.created_at DESC
    `);

    allStores.rows.forEach((store, idx) => {
      console.log(`${idx + 1}. ${store.store_name || store.domain}`);
      console.log(`   ID: ${store.id}`);
      console.log(`   Owner: ${store.owner_email || 'Unknown'}`);
      console.log(`   Created: ${new Date(store.created_at).toLocaleDateString()}`);
      console.log(`   Data: ${store.conversations} convs, ${store.messages} msgs`);
      if (parseInt(store.messages) > 0) {
        console.log(`   ✅ HAS DATA - Analytics will work!`);
      }
      console.log();
    });

    // Check users table to see who you might be
    console.log('\n👤 Users in Production:\n');
    const users = await pool.query(`
      SELECT id, email, name, role, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `);

    users.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.email}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   User ID: ${user.id}\n`);
    });

    // Provide solution
    console.log('\n' + '='.repeat(70));
    console.log('💡 SOLUTION:\n');
    console.log('Option 1: Use an existing store that has data');
    console.log('  → Pick any store from the list above that has messages\n');

    console.log('Option 2: Create your Zoroh store in production');
    console.log('  → Go to the onboarding flow');
    console.log('  → Connect your Shopify store');
    console.log('  → This will create the store in production database\n');

    console.log('Option 3: Chat with widget to generate data');
    console.log('  → Visit your product page');
    console.log('  → Use the widget to ask questions');
    console.log('  → Data will appear in analytics\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findUserStores();
