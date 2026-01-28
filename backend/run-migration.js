#!/usr/bin/env node
/**
 * Run database migration
 * Usage: node run-migration.js <migration_number>
 * Example: node run-migration.js 015
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const migrationNumber = process.argv[2];

if (!migrationNumber) {
  console.error('Usage: node run-migration.js <migration_number>');
  console.error('Example: node run-migration.js 015');

  // List available migrations
  const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    console.log('\nAvailable migrations:');
    fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()
      .forEach(f => console.log('  ' + f));
  }
  process.exit(1);
}

// Find the migration file that starts with the given number
const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.startsWith(migrationNumber) && f.endsWith('.sql'));

if (files.length === 0) {
  console.error(`No migration file found starting with: ${migrationNumber}`);
  console.error('Available migrations:');
  fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .forEach(f => console.error('  ' + f));
  process.exit(1);
}

const migrationFile = path.join(migrationsDir, files[0]);
const sql = fs.readFileSync(migrationFile, 'utf8');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log(`Running migration: ${files[0]}`);
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
