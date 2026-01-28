/**
 * Maintenance Routes
 * Automated maintenance endpoints for syncing, health checks, etc.
 */
import { Router } from 'express';
import maintenanceController from '../controllers/maintenance.controller';
import { FACE_SCAN_MIGRATION_SQL } from '../migrations/face-scan-migration';
import { SKINCARE_PLATFORM_MIGRATION_SQL } from '../migrations/skincare-platform-migration';

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
    const expectedSecret = process.env.ADMIN_SECRET || 'your-super-secret-key-change-this';
    if (adminSecret !== expectedSecret) {
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

// Run skincare platform migration (requires admin secret)
router.post('/migrate/skincare-platform', async (req, res) => {
  try {
    // Verify admin secret
    const adminSecret = req.headers['x-admin-secret'] || req.query.secret;
    const expectedSecret = process.env.ADMIN_SECRET || 'your-super-secret-key-change-this';
    if (adminSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid admin secret'
      });
    }

    const { pool } = require('../config/database');

    console.log('Running skincare platform migration...');

    // Execute migration
    await pool.query(SKINCARE_PLATFORM_MIGRATION_SQL);

    console.log('Skincare platform migration completed successfully');

    res.json({
      success: true,
      message: 'Skincare platform migration completed successfully',
      tables: [
        'widget_users',
        'widget_auth_tokens',
        'user_progress',
        'user_milestones',
        'goal_templates',
        'user_goals',
        'user_routines',
        'routine_steps',
        'routine_logs',
        'recommendation_feedback',
        'behavior_signals',
        'aggregated_insights',
        'user_allergens',
        'user_safety_preferences',
        'product_safety_scans',
        'skincare_knowledge',
        'user_predictions',
        'face_previews'
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

// Get platform stats (public - for dashboard)
router.get('/stats', async (req, res) => {
  try {
    const { pool } = require('../config/database');

    // Get total widget users
    const usersResult = await pool.query(`
      SELECT COUNT(*) as total_users,
             COUNT(DISTINCT store_id) as total_stores
      FROM widget_users
    `);

    // Get total face scans
    const scansResult = await pool.query(`
      SELECT COUNT(*) as total_scans,
             COUNT(DISTINCT user_id) as users_with_scans
      FROM face_scans
    `);

    // Get feedback stats
    const feedbackResult = await pool.query(`
      SELECT COUNT(*) as total_feedback,
             COUNT(DISTINCT user_id) as users_gave_feedback,
             COUNT(DISTINCT attribute) as attributes_with_feedback
      FROM scan_feedback
    `);

    // Get recent activity (last 7 days)
    const recentResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM widget_users WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d,
        (SELECT COUNT(*) FROM face_scans WHERE created_at > NOW() - INTERVAL '7 days') as scans_7d,
        (SELECT COUNT(*) FROM scan_feedback WHERE created_at > NOW() - INTERVAL '7 days') as feedback_7d
    `);

    // Get accuracy by attribute (if feedback exists)
    const accuracyResult = await pool.query(`
      SELECT attribute,
             COUNT(*) as total,
             SUM(CASE WHEN feedback_type = 'correction' THEN 1 ELSE 0 END) as corrections,
             SUM(CASE WHEN feedback_type = 'confirmation' THEN 1 ELSE 0 END) as confirmations
      FROM scan_feedback
      GROUP BY attribute
    `);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers: parseInt(usersResult.rows[0]?.total_users || 0),
          totalStores: parseInt(usersResult.rows[0]?.total_stores || 0),
          totalScans: parseInt(scansResult.rows[0]?.total_scans || 0),
          usersWithScans: parseInt(scansResult.rows[0]?.users_with_scans || 0),
        },
        feedback: {
          totalFeedback: parseInt(feedbackResult.rows[0]?.total_feedback || 0),
          usersGaveFeedback: parseInt(feedbackResult.rows[0]?.users_gave_feedback || 0),
          attributesWithFeedback: parseInt(feedbackResult.rows[0]?.attributes_with_feedback || 0),
        },
        recent7Days: {
          newUsers: parseInt(recentResult.rows[0]?.new_users_7d || 0),
          scans: parseInt(recentResult.rows[0]?.scans_7d || 0),
          feedback: parseInt(recentResult.rows[0]?.feedback_7d || 0),
        },
        accuracyByAttribute: accuracyResult.rows.map(row => ({
          attribute: row.attribute,
          total: parseInt(row.total),
          corrections: parseInt(row.corrections),
          confirmations: parseInt(row.confirmations),
          correctionRate: row.total > 0 ? (row.corrections / row.total * 100).toFixed(1) + '%' : '0%'
        })),
        learnings: generateLearnings(accuracyResult.rows)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

// Helper to generate learnings from data
function generateLearnings(accuracyData: any[]) {
  const learnings: string[] = [];

  for (const row of accuracyData) {
    const total = parseInt(row.total);
    const corrections = parseInt(row.corrections);
    const confirmations = parseInt(row.confirmations);

    if (total < 5) continue; // Need minimum data

    const correctionRate = corrections / total;

    if (correctionRate > 0.5) {
      learnings.push(`${row.attribute}: High correction rate (${(correctionRate*100).toFixed(0)}%) - AI may be over/under detecting`);
    } else if (correctionRate < 0.2 && total >= 10) {
      learnings.push(`${row.attribute}: Good accuracy (${((1-correctionRate)*100).toFixed(0)}% confirmed)`);
    }
  }

  if (learnings.length === 0) {
    learnings.push('Collecting more feedback to generate learnings...');
  }

  return learnings;
}

export default router;
