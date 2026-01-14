/**
 * Maintenance Routes
 * Automated maintenance endpoints for syncing, health checks, etc.
 */
import { Router } from 'express';
import maintenanceController from '../controllers/maintenance.controller';
import { FACE_SCAN_MIGRATION_SQL } from '../migrations/face-scan-migration';

const router = Router();

// Trigger Shopify sync (requires admin secret)
router.post('/sync/:storeId', maintenanceController.syncStore.bind(maintenanceController));

// Get products for verification (requires admin secret)
router.get('/products/:storeId', maintenanceController.getProducts.bind(maintenanceController));

// Get sync status (public)
router.get('/sync-status/:storeId', maintenanceController.getSyncStatus.bind(maintenanceController));

// Run face scan migration (requires admin secret)
router.post('/migrate/face-scan', async (req, res) => {
  try {
    // Verify admin secret
    const adminSecret = req.headers['x-admin-secret'] || req.query.secret;
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid admin secret'
      });
    }

    const { pool } = require('../config/database');

    console.log('Running face scan migration...');

    // Execute migration
    await pool.query(FACE_SCAN_MIGRATION_SQL);

    console.log('Face scan migration completed successfully');

    res.json({
      success: true,
      message: 'Face scan migration completed successfully',
      tables: [
        'face_scans',
        'face_analysis',
        'face_scan_recommendations',
        'face_scan_sessions',
        'face_scan_events'
      ]
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
