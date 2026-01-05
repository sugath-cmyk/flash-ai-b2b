import { Pool } from 'pg';
import queryCategorizationService from '../services/query-categorization.service';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sugathsurendran@localhost:5432/flash_ai_b2b';
const STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function backfillCategories() {
  console.log('🔄 Backfilling Query Categories\n');
  console.log('Store ID:', STORE_ID);
  console.log('');

  try {
    // Get all user messages without categories
    const result = await pool.query(
      `SELECT id, content
       FROM widget_messages
       WHERE store_id = $1
         AND role = 'user'
         AND query_category IS NULL
       ORDER BY created_at ASC`,
      [STORE_ID]
    );

    console.log(`Found ${result.rows.length} messages to categorize\n`);

    if (result.rows.length === 0) {
      console.log('✅ All messages already categorized!');
      await pool.end();
      return;
    }

    let categorized = 0;
    let failed = 0;

    for (const msg of result.rows) {
      try {
        // Analyze the query
        const analysis = queryCategorizationService.analyzeQuery(msg.content);

        // Update the message
        await pool.query(
          `UPDATE widget_messages
           SET query_category = $1,
               query_intent = $2,
               query_topics = $3,
               query_metadata = jsonb_build_object('confidence', $4::float, 'backfilled', true)
           WHERE id = $5`,
          [
            analysis.category,
            analysis.intent,
            analysis.topics,
            analysis.confidence,
            msg.id
          ]
        );

        categorized++;
        if (categorized % 10 === 0) {
          console.log(`Progress: ${categorized}/${result.rows.length} messages categorized...`);
        }
      } catch (error) {
        console.error(`Failed to categorize message ${msg.id}:`, error);
        failed++;
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Backfill Complete!');
    console.log(`   Categorized: ${categorized}`);
    console.log(`   Failed: ${failed}`);
    console.log('');
    console.log('Category breakdown:');

    const breakdown = await pool.query(
      `SELECT query_category, COUNT(*) as count
       FROM widget_messages
       WHERE store_id = $1 AND role = 'user' AND query_category IS NOT NULL
       GROUP BY query_category
       ORDER BY count DESC`,
      [STORE_ID]
    );

    breakdown.rows.forEach(row => {
      console.log(`   ${row.query_category}: ${row.count}`);
    });

    await pool.end();
  } catch (error: any) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

backfillCategories();
