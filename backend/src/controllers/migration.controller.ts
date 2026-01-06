import { Request, Response } from 'express';
import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration Controller
 * Secure endpoint to run database migrations in production
 */
export class MigrationController {
  /**
   * Run discount and offers migration
   * Endpoint: POST /api/migrate/run-discounts-migration
   * Requires: ADMIN_SECRET in header
   */
  async runDiscountsMigration(req: Request, res: Response) {
    try {
      // Security check - require admin secret
      const adminSecret = req.headers['x-admin-secret'] || req.body.adminSecret;
      const expectedSecret = process.env.ADMIN_SECRET || 'your-super-secret-key-change-this';

      if (adminSecret !== expectedSecret) {
        throw createError('Unauthorized: Invalid admin secret', 401);
      }

      console.log('🔄 Starting discounts migration...');

      // Check if tables already exist
      const tablesCheck = await pool.query(`
        SELECT
          EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'extracted_discounts') AS has_discounts,
          EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'store_offers') AS has_offers
      `);

      const { has_discounts, has_offers } = tablesCheck.rows[0];

      if (has_discounts && has_offers) {
        return res.json({
          success: true,
          message: 'Migration already completed - tables already exist',
          alreadyExists: true,
          tables: {
            extracted_discounts: true,
            store_offers: true,
          },
        });
      }

      // Read migration file
      const migrationPath = path.join(__dirname, '../../database/migrations/011_discounts_and_offers.sql');

      if (!fs.existsSync(migrationPath)) {
        throw createError('Migration file not found', 500);
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

      // Run migration
      await pool.query(migrationSQL);

      console.log('✅ Migration completed successfully');

      // Verify tables were created
      const verifyCheck = await pool.query(`
        SELECT
          EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'extracted_discounts') AS has_discounts,
          EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'store_offers') AS has_offers
      `);

      const verification = verifyCheck.rows[0];

      res.json({
        success: true,
        message: 'Migration completed successfully',
        tablesCreated: {
          extracted_discounts: verification.has_discounts,
          store_offers: verification.has_offers,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('❌ Migration failed:', error);
      throw createError(`Migration failed: ${error.message}`, 500);
    }
  }

  /**
   * Check migration status
   * Endpoint: GET /api/migrate/status
   */
  async getMigrationStatus(req: Request, res: Response) {
    try {
      const tablesCheck = await pool.query(`
        SELECT
          EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'extracted_discounts') AS has_discounts_table,
          EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'store_offers') AS has_offers_table
      `);

      const tables = tablesCheck.rows[0];

      let discountCount = 0;
      let offerCount = 0;

      if (tables.has_discounts_table) {
        const discountResult = await pool.query('SELECT COUNT(*) as count FROM extracted_discounts');
        discountCount = parseInt(discountResult.rows[0].count);
      }

      if (tables.has_offers_table) {
        const offerResult = await pool.query('SELECT COUNT(*) as count FROM store_offers');
        offerCount = parseInt(offerResult.rows[0].count);
      }

      const migrationComplete = tables.has_discounts_table && tables.has_offers_table;

      res.json({
        success: true,
        migrationComplete,
        tables: {
          extracted_discounts: {
            exists: tables.has_discounts_table,
            count: discountCount,
          },
          store_offers: {
            exists: tables.has_offers_table,
            count: offerCount,
          },
        },
        message: migrationComplete
          ? 'Migration is complete'
          : 'Migration not yet run - tables missing',
      });
    } catch (error: any) {
      throw createError(`Failed to check migration status: ${error.message}`, 500);
    }
  }
}

export default new MigrationController();
