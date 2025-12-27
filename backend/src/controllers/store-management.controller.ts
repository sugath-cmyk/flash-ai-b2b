import { Request, Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { ShopifyExtractionService } from '../services/shopify-api.service';

/**
 * Store Management Controller
 * Handles sync operations and store management for brand owners
 */

/**
 * Trigger manual sync for a store
 */
export const triggerSync = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get store details
    const storeResult = await pool.query(
      `SELECT * FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    // Check permissions (owner or admin)
    if (store.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to sync this store',
      });
    }

    // Check if store is connected to Shopify
    if (!store.shopify_shop_domain || !store.shopify_access_token) {
      return res.status(400).json({
        success: false,
        message: 'Store is not connected to Shopify. Please connect first.',
      });
    }

    // Check if sync is already in progress
    const existingJobResult = await pool.query(
      `SELECT id, status FROM extraction_jobs
       WHERE store_id = $1 AND status = 'processing'
       ORDER BY created_at DESC LIMIT 1`,
      [storeId]
    );

    if (existingJobResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Sync is already in progress for this store',
        jobId: existingJobResult.rows[0].id,
      });
    }

    // Start extraction in background (non-blocking)
    ShopifyExtractionService.extractStoreData(storeId).catch((error) => {
      console.error(`Background extraction failed for store ${storeId}:`, error);
    });

    res.json({
      success: true,
      message: 'Sync started successfully',
    });
  } catch (error: any) {
    console.error('Trigger sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger sync',
      error: error.message,
    });
  }
};

/**
 * Get sync status for a store
 */
export const getSyncStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get store details
    const storeResult = await pool.query(
      `SELECT user_id, sync_status, last_sync FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    // Check permissions
    if (store.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this store',
      });
    }

    // Get latest extraction job
    const jobResult = await pool.query(
      `SELECT * FROM extraction_jobs
       WHERE store_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [storeId]
    );

    const latestJob = jobResult.rows[0] || null;

    // Get counts
    const countsResult = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM extracted_products WHERE store_id = $1) as products_count,
         (SELECT COUNT(*) FROM extracted_collections WHERE store_id = $1) as collections_count,
         (SELECT COUNT(*) FROM extracted_pages WHERE store_id = $1) as pages_count`,
      [storeId]
    );

    const counts = countsResult.rows[0];

    res.json({
      success: true,
      data: {
        syncStatus: store.sync_status,
        lastSync: store.last_sync,
        latestJob: latestJob
          ? {
              id: latestJob.id,
              status: latestJob.status,
              progress: latestJob.progress,
              totalItems: latestJob.total_items,
              itemsProcessed: latestJob.items_processed,
              startedAt: latestJob.started_at,
              completedAt: latestJob.completed_at,
              errorMessage: latestJob.error_message,
            }
          : null,
        counts: {
          products: parseInt(counts.products_count),
          collections: parseInt(counts.collections_count),
          pages: parseInt(counts.pages_count),
        },
      },
    });
  } catch (error: any) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
      error: error.message,
    });
  }
};

/**
 * Setup webhooks for real-time sync
 */
export const setupWebhooks = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get store details
    const storeResult = await pool.query(
      `SELECT * FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    // Check permissions
    if (store.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this store',
      });
    }

    // Setup webhooks
    await ShopifyExtractionService.setupWebhooks(storeId);

    res.json({
      success: true,
      message: 'Webhooks configured successfully',
    });
  } catch (error: any) {
    console.error('Setup webhooks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup webhooks',
      error: error.message,
    });
  }
};

/**
 * Update auto-sync settings
 */
export const updateAutoSync = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const { enabled, frequency } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Validate frequency
    const validFrequencies = ['hourly', 'daily', 'weekly'];
    if (frequency && !validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`,
      });
    }

    // Get store details
    const storeResult = await pool.query(
      `SELECT user_id FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    // Check permissions
    if (store.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this store',
      });
    }

    // Update settings
    await pool.query(
      `UPDATE stores
       SET auto_sync_enabled = COALESCE($1, auto_sync_enabled),
           sync_frequency = COALESCE($2, sync_frequency),
           updated_at = NOW()
       WHERE id = $3`,
      [enabled, frequency, storeId]
    );

    res.json({
      success: true,
      message: 'Auto-sync settings updated successfully',
    });
  } catch (error: any) {
    console.error('Update auto-sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update auto-sync settings',
      error: error.message,
    });
  }
};

/**
 * Get sync history (all extraction jobs)
 */
export const getSyncHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const limit = parseInt(req.query.limit as string) || 10;

    // Get store details
    const storeResult = await pool.query(
      `SELECT user_id FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    // Check permissions
    if (store.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this store',
      });
    }

    // Get extraction jobs history
    const jobsResult = await pool.query(
      `SELECT id, job_type, status, progress, total_items, items_processed,
              error_message, started_at, completed_at, created_at
       FROM extraction_jobs
       WHERE store_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [storeId, limit]
    );

    res.json({
      success: true,
      data: jobsResult.rows,
    });
  } catch (error: any) {
    console.error('Get sync history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync history',
      error: error.message,
    });
  }
};
