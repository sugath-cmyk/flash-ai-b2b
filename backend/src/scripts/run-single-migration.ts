import { pool } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runSingleMigration(migrationFile: string) {
  try {
    console.log(`🔄 Running migration: ${migrationFile}`);

    const migrationsDir = path.join(__dirname, '../../../database/migrations');
    const filePath = path.join(migrationsDir, migrationFile);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${migrationFile}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);

    console.log(`✅ Migration completed successfully: ${migrationFile}`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

// Get migration file from command line arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Please specify a migration file to run');
  console.error('Usage: npx ts-node src/scripts/run-single-migration.ts <migration-file.sql>');
  process.exit(1);
}

runSingleMigration(migrationFile);
