import { pool } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');

    const migrationsDir = path.join(__dirname, '../../../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of migrationFiles) {
      console.log(`  Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      console.log(`  ✅ Completed: ${file}`);
    }

    console.log('✅ All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with development data...');

    const seedFile = path.join(__dirname, '../../../database/seeds/dev_data.sql');
    if (fs.existsSync(seedFile)) {
      const sql = fs.readFileSync(seedFile, 'utf8');
      await pool.query(sql);
      console.log('✅ Database seeded successfully');
    } else {
      console.log('⚠️ No seed file found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Check command line arguments
const command = process.argv[2];

if (command === 'seed') {
  seedDatabase();
} else {
  runMigrations();
}
