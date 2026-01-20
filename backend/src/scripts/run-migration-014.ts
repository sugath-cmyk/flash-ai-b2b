import { pool } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration014() {
  try {
    console.log('🔄 Running migration 014_skincare_platform.sql...');

    const migrationPath = path.join(__dirname, '../../../database/migrations/014_skincare_platform.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('✅ Migration 014_skincare_platform.sql completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration014();
