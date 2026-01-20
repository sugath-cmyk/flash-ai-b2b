import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function checkTables() {
  try {
    console.log('Checking database tables...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('widget_users', 'user_progress', 'goal_templates', 'widget_auth_tokens')
      ORDER BY table_name
    `);

    console.log('Found tables:', result.rows.map(r => r.table_name));

    if (result.rows.length === 0) {
      console.log('No skincare platform tables found!');
    } else {
      console.log(`Found ${result.rows.length} skincare platform tables`);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTables();
