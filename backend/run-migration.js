#!/usr/bin/env node
/**
 * Run database migration
 * Usage: node run-migration.js 012
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const migrationNumber = process.argv[2];

if (!migrationNumber) {
  console.error('Usage: node run-migration.js <migration_number>');
  console.error('Example: node run-migration.js 012');
  process.exit(1);
}

const migrationFile = path.join(__dirname, '..', 'database', 'migrations', `${migrationNumber}_add_widget_settings.sql`);

if (!fs.existsSync(migrationFile)) {
  console.error(`Migration file not found: ${migrationFile}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationFile, 'utf8');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log(`Running migration: ${migrationNumber}_add_widget_settings.sql`);
    console.log('---');

    await client.query(sql);

    console.log('---');
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
