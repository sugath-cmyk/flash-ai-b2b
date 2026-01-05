import { Pool } from 'pg';

const STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sugathsurendran@localhost:5432/flash_ai_b2b';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function checkSimple() {
  console.log('🔍 Quick Production Check\n');
  console.log('Store ID:', STORE_ID);
  console.log('');

  try {
    // Check store
    const store = await pool.query('SELECT store_name, domain FROM stores WHERE id = $1', [STORE_ID]);
    console.log('✅ Store:', store.rows[0].store_name);
    console.log('   Domain:', store.rows[0].domain);
    console.log('');

    // Check conversations
    const convs = await pool.query('SELECT COUNT(*) FROM widget_conversations WHERE store_id = $1', [STORE_ID]);
    console.log('📊 Conversations:', convs.rows[0].count);

    // Check messages
    const msgs = await pool.query('SELECT COUNT(*) FROM widget_messages WHERE store_id = $1', [STORE_ID]);
    console.log('💬 Messages:', msgs.rows[0].count);

    // Check analytics columns
    console.log('');
    console.log('Checking analytics schema...');
    const cols = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'widget_messages'
        AND column_name IN ('query_category', 'query_intent', 'query_topics')
    `);

    if (cols.rows.length === 0) {
      console.log('❌ Analytics columns MISSING!');
      console.log('');
      console.log('This is why analytics shows no data:');
      console.log('  - Migration 010_query_analytics.sql NOT applied to production');
      console.log('  - Analytics endpoints require these columns');
      console.log('  - Need to run migration on production database');
    } else {
      console.log('✅ Analytics columns exist:', cols.rows.map(r => r.column_name).join(', '));
    }

    await pool.end();
  } catch (error: any) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSimple();
