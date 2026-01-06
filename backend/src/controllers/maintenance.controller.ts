/**
 * Maintenance Controller
 * Endpoints for automated maintenance tasks (sync, health checks, etc.)
 */
import { Request, Response } from 'express';
import { ShopifyExtractionService } from '../services/shopify-api.service';
import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';

export class MaintenanceController {
  /**
   * Trigger Shopify sync for a store
   * POST /api/maintenance/sync/:storeId
   * Requires x-admin-secret header
   */
  async syncStore(req: Request, res: Response) {
    try {
      const { storeId } = req.params;
      const adminSecret = req.headers['x-admin-secret'] || req.body.adminSecret;
      const expectedSecret = process.env.ADMIN_SECRET || 'your-super-secret-key-change-this';

      if (adminSecret !== expectedSecret) {
        throw createError('Unauthorized: Invalid admin secret', 401);
      }

      console.log(`Starting sync for store: ${storeId}`);

      // Verify store exists
      const storeResult = await pool.query(
        'SELECT id, shopify_store_url FROM stores WHERE id = $1',
        [storeId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found', 404);
      }

      const store = storeResult.rows[0];

      // Trigger sync
      await ShopifyExtractionService.extractStoreData(storeId);

      // Get product count after sync
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM extracted_products WHERE store_id = $1',
        [storeId]
      );

      res.json({
        success: true,
        message: 'Sync completed successfully',
        data: {
          storeId,
          shopifyUrl: store.shopify_store_url,
          productsCount: parseInt(countResult.rows[0].count),
          syncedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get current product data for verification
   * GET /api/maintenance/products/:storeId
   * Requires x-admin-secret header
   */
  async getProducts(req: Request, res: Response) {
    try {
      const { storeId } = req.params;
      const { search } = req.query;
      const adminSecret = req.headers['x-admin-secret'];
      const expectedSecret = process.env.ADMIN_SECRET || 'your-super-secret-key-change-this';

      if (adminSecret !== expectedSecret) {
        throw createError('Unauthorized: Invalid admin secret', 401);
      }

      let query = `
        SELECT title, price, compare_at_price, product_type, status, updated_at
        FROM extracted_products
        WHERE store_id = $1
      `;
      const params: any[] = [storeId];

      if (search) {
        query += ` AND title ILIKE $2`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY updated_at DESC LIMIT 50`;

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: {
          products: result.rows,
          count: result.rows.length,
        },
      });
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get sync status and last sync time
   * GET /api/maintenance/sync-status/:storeId
   * Public endpoint
   */
  async getSyncStatus(req: Request, res: Response) {
    try {
      const { storeId } = req.params;

      const result = await pool.query(
        `SELECT
          COUNT(*) as product_count,
          MAX(updated_at) as last_updated
         FROM extracted_products
         WHERE store_id = $1`,
        [storeId]
      );

      res.json({
        success: true,
        data: {
          storeId,
          productCount: parseInt(result.rows[0].product_count),
          lastUpdated: result.rows[0].last_updated,
        },
      });
    } catch (error: any) {
      throw error;
    }
  }
}

export default new MaintenanceController();
