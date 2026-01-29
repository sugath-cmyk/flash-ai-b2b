/**
 * Maintenance Routes
 * Automated maintenance endpoints for syncing, health checks, etc.
 */
import { Router } from 'express';
import maintenanceController from '../controllers/maintenance.controller';
import { FACE_SCAN_MIGRATION_SQL } from '../migrations/face-scan-migration';
import { SKINCARE_PLATFORM_MIGRATION_SQL } from '../migrations/skincare-platform-migration';
import scanCalibrationService from '../services/scan-calibration.service';

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

// Run dark circles columns migration (requires admin secret)
router.post('/migrate/dark-circles-columns', async (req, res) => {
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

    console.log('Running dark circles columns migration...');

    // Add columns for detailed dark circles analysis
    await pool.query(`
      ALTER TABLE face_analysis
      ADD COLUMN IF NOT EXISTS dark_circles_left_severity FLOAT,
      ADD COLUMN IF NOT EXISTS dark_circles_right_severity FLOAT,
      ADD COLUMN IF NOT EXISTS dark_circles_regions JSONB;
    `);

    console.log('Dark circles columns migration completed');

    res.json({
      success: true,
      message: 'Dark circles columns added successfully',
      columns: ['dark_circles_left_severity', 'dark_circles_right_severity', 'dark_circles_regions']
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: error.message
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

// =============================================================================
// UNIFIED ADMIN DASHBOARD - All stats in one endpoint
// =============================================================================
router.get('/dashboard', async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const startTime = Date.now();

    // Run all queries in parallel for performance
    const [
      usersResult,
      scansResult,
      feedbackResult,
      recentResult,
      accuracyResult,
      routinesResult,
      goalsResult,
      topConcernsResult,
      scanQualityResult
    ] = await Promise.all([
      // 1. Widget Users
      pool.query(`
        SELECT COUNT(*) as total_users,
               COUNT(DISTINCT store_id) as total_stores,
               COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users
        FROM widget_users
      `),

      // 2. Face Scans
      pool.query(`
        SELECT COUNT(*) as total_scans,
               COUNT(DISTINCT user_id) as users_with_scans,
               AVG(quality_score) as avg_quality
        FROM face_scans
      `),

      // 3. ML Feedback
      pool.query(`
        SELECT COUNT(*) as total_feedback,
               COUNT(DISTINCT user_id) as users_gave_feedback,
               COUNT(DISTINCT attribute) as attributes_covered,
               SUM(CASE WHEN feedback_type = 'correction' THEN 1 ELSE 0 END) as corrections,
               SUM(CASE WHEN feedback_type = 'confirmation' THEN 1 ELSE 0 END) as confirmations
        FROM scan_feedback
      `).catch(() => ({ rows: [{ total_feedback: 0, users_gave_feedback: 0, attributes_covered: 0, corrections: 0, confirmations: 0 }] })),

      // 4. Recent Activity (7 days)
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM widget_users WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d,
          (SELECT COUNT(*) FROM face_scans WHERE created_at > NOW() - INTERVAL '7 days') as scans_7d,
          (SELECT COUNT(*) FROM widget_users WHERE created_at > NOW() - INTERVAL '1 day') as new_users_24h,
          (SELECT COUNT(*) FROM face_scans WHERE created_at > NOW() - INTERVAL '1 day') as scans_24h
      `),

      // 5. Accuracy by Attribute
      pool.query(`
        SELECT attribute,
               COUNT(*) as total,
               SUM(CASE WHEN feedback_type = 'correction' THEN 1 ELSE 0 END) as corrections,
               SUM(CASE WHEN feedback_type = 'confirmation' THEN 1 ELSE 0 END) as confirmations,
               AVG(CASE WHEN feedback_type = 'correction'
                   THEN ABS(original_grade - COALESCE(user_corrected_grade, 0))
                   ELSE 0 END) as avg_error
        FROM scan_feedback
        GROUP BY attribute
        ORDER BY total DESC
      `).catch(() => ({ rows: [] })),

      // 6. Routines Stats
      pool.query(`
        SELECT COUNT(*) as total_routines,
               COUNT(DISTINCT user_id) as users_with_routines,
               AVG(CASE WHEN is_active THEN 1 ELSE 0 END) * 100 as active_rate
        FROM user_routines
      `).catch(() => ({ rows: [{ total_routines: 0, users_with_routines: 0, active_rate: 0 }] })),

      // 7. Goals Stats
      pool.query(`
        SELECT COUNT(*) as total_goals,
               COUNT(DISTINCT user_id) as users_with_goals,
               SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_goals
        FROM user_goals
      `).catch(() => ({ rows: [{ total_goals: 0, users_with_goals: 0, completed_goals: 0 }] })),

      // 8. Top Skin Concerns (from scans)
      pool.query(`
        SELECT
          SUM(CASE WHEN (analysis->>'acne_score')::int > 30 THEN 1 ELSE 0 END) as acne_concerns,
          SUM(CASE WHEN (analysis->>'dark_circles_score')::int > 30 THEN 1 ELSE 0 END) as dark_circles_concerns,
          SUM(CASE WHEN (analysis->>'pigmentation_score')::int > 30 THEN 1 ELSE 0 END) as pigmentation_concerns,
          SUM(CASE WHEN (analysis->>'wrinkle_score')::int > 30 THEN 1 ELSE 0 END) as wrinkle_concerns,
          SUM(CASE WHEN (analysis->>'redness_score')::int > 30 THEN 1 ELSE 0 END) as redness_concerns
        FROM face_scans
        WHERE analysis IS NOT NULL
      `).catch(() => ({ rows: [{}] })),

      // 9. Scan Quality Distribution
      pool.query(`
        SELECT
          SUM(CASE WHEN quality_score >= 0.8 THEN 1 ELSE 0 END) as high_quality,
          SUM(CASE WHEN quality_score >= 0.5 AND quality_score < 0.8 THEN 1 ELSE 0 END) as medium_quality,
          SUM(CASE WHEN quality_score < 0.5 THEN 1 ELSE 0 END) as low_quality
        FROM face_scans
      `).catch(() => ({ rows: [{ high_quality: 0, medium_quality: 0, low_quality: 0 }] }))
    ]);

    // Process accuracy data and generate learnings
    const accuracyByAttribute = accuracyResult.rows.map((row: any) => ({
      attribute: row.attribute,
      total: parseInt(row.total || 0),
      corrections: parseInt(row.corrections || 0),
      confirmations: parseInt(row.confirmations || 0),
      accuracy: row.total > 0 ? ((row.confirmations / row.total) * 100).toFixed(1) : '0',
      avgError: parseFloat(row.avg_error || 0).toFixed(2)
    }));

    // Generate learnings and recommendations
    const learnings = generateLearnings(accuracyResult.rows);
    const recommendations = generateRecommendations(accuracyResult.rows, scansResult.rows[0], feedbackResult.rows[0]);

    // Build top concerns array
    const topConcerns = [];
    const concerns = topConcernsResult.rows[0] || {};
    if (concerns.acne_concerns > 0) topConcerns.push({ name: 'Acne', count: parseInt(concerns.acne_concerns) });
    if (concerns.dark_circles_concerns > 0) topConcerns.push({ name: 'Dark Circles', count: parseInt(concerns.dark_circles_concerns) });
    if (concerns.pigmentation_concerns > 0) topConcerns.push({ name: 'Pigmentation', count: parseInt(concerns.pigmentation_concerns) });
    if (concerns.wrinkle_concerns > 0) topConcerns.push({ name: 'Wrinkles', count: parseInt(concerns.wrinkle_concerns) });
    if (concerns.redness_concerns > 0) topConcerns.push({ name: 'Redness', count: parseInt(concerns.redness_concerns) });
    topConcerns.sort((a, b) => b.count - a.count);

    const queryTime = Date.now() - startTime;

    res.json({
      success: true,
      dashboard: {
        // === SECTION 1: Platform Overview ===
        platform: {
          totalUsers: parseInt(usersResult.rows[0]?.total_users || 0),
          verifiedUsers: parseInt(usersResult.rows[0]?.verified_users || 0),
          totalStores: parseInt(usersResult.rows[0]?.total_stores || 0),
          totalScans: parseInt(scansResult.rows[0]?.total_scans || 0),
          usersWithScans: parseInt(scansResult.rows[0]?.users_with_scans || 0),
          avgScanQuality: parseFloat(scansResult.rows[0]?.avg_quality || 0).toFixed(2)
        },

        // === SECTION 2: Recent Activity ===
        activity: {
          last24Hours: {
            newUsers: parseInt(recentResult.rows[0]?.new_users_24h || 0),
            scans: parseInt(recentResult.rows[0]?.scans_24h || 0)
          },
          last7Days: {
            newUsers: parseInt(recentResult.rows[0]?.new_users_7d || 0),
            scans: parseInt(recentResult.rows[0]?.scans_7d || 0)
          }
        },

        // === SECTION 3: ML Training & Accuracy ===
        mlTraining: {
          totalFeedback: parseInt(feedbackResult.rows[0]?.total_feedback || 0),
          usersGaveFeedback: parseInt(feedbackResult.rows[0]?.users_gave_feedback || 0),
          corrections: parseInt(feedbackResult.rows[0]?.corrections || 0),
          confirmations: parseInt(feedbackResult.rows[0]?.confirmations || 0),
          overallAccuracy: feedbackResult.rows[0]?.total_feedback > 0
            ? ((feedbackResult.rows[0].confirmations / feedbackResult.rows[0].total_feedback) * 100).toFixed(1) + '%'
            : 'No data yet',
          accuracyByAttribute
        },

        // === SECTION 4: Engagement ===
        engagement: {
          routines: {
            total: parseInt(routinesResult.rows[0]?.total_routines || 0),
            usersWithRoutines: parseInt(routinesResult.rows[0]?.users_with_routines || 0),
            activeRate: parseFloat(routinesResult.rows[0]?.active_rate || 0).toFixed(1) + '%'
          },
          goals: {
            total: parseInt(goalsResult.rows[0]?.total_goals || 0),
            usersWithGoals: parseInt(goalsResult.rows[0]?.users_with_goals || 0),
            completed: parseInt(goalsResult.rows[0]?.completed_goals || 0)
          }
        },

        // === SECTION 5: Skin Insights ===
        skinInsights: {
          topConcerns: topConcerns.slice(0, 5),
          scanQuality: {
            high: parseInt(scanQualityResult.rows[0]?.high_quality || 0),
            medium: parseInt(scanQualityResult.rows[0]?.medium_quality || 0),
            low: parseInt(scanQualityResult.rows[0]?.low_quality || 0)
          }
        },

        // === SECTION 6: Learnings & Recommendations ===
        insights: {
          learnings,
          recommendations,
          dataHealth: getDataHealthStatus(
            parseInt(usersResult.rows[0]?.total_users || 0),
            parseInt(scansResult.rows[0]?.total_scans || 0),
            parseInt(feedbackResult.rows[0]?.total_feedback || 0)
          )
        },

        // === SECTION 7: Calibration Status ===
        calibration: await (async () => {
          try {
            const summary = await scanCalibrationService.getCalibrationSummary();
            return {
              lastCalibration: summary.lastCalibration,
              needsRecalibration: summary.needsRecalibration,
              recommendation: summary.recommendation,
              attributeCount: summary.attributes.length
            };
          } catch {
            return { lastCalibration: null, needsRecalibration: true, recommendation: 'Run initial calibration' };
          }
        })(),

        // === SECTION 8: System Health ===
        system: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          nodeVersion: process.version,
          queryTimeMs: queryTime
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard',
      message: error.message
    });
  }
});

// Keep simple stats endpoint for backwards compatibility
router.get('/stats', async (req, res) => {
  // Redirect to dashboard
  res.redirect('/api/maintenance/dashboard');
});

// Helper: Generate learnings from feedback data
function generateLearnings(accuracyData: any[]) {
  const learnings: string[] = [];

  for (const row of accuracyData) {
    const total = parseInt(row.total || 0);
    const corrections = parseInt(row.corrections || 0);
    if (total < 3) continue;

    const correctionRate = corrections / total;
    const avgError = parseFloat(row.avg_error || 0);

    if (correctionRate > 0.6) {
      learnings.push(`⚠️ ${row.attribute}: ${(correctionRate*100).toFixed(0)}% correction rate - needs calibration`);
    } else if (correctionRate > 0.4) {
      learnings.push(`📊 ${row.attribute}: ${(correctionRate*100).toFixed(0)}% corrections - moderate accuracy`);
    } else if (correctionRate < 0.2 && total >= 5) {
      learnings.push(`✅ ${row.attribute}: ${((1-correctionRate)*100).toFixed(0)}% accuracy - performing well`);
    }

    if (avgError > 1.5) {
      learnings.push(`🎯 ${row.attribute}: Avg error ${avgError.toFixed(1)} grades - thresholds need adjustment`);
    }
  }

  if (learnings.length === 0) {
    learnings.push('📈 Collecting feedback to generate ML learnings...');
  }

  return learnings;
}

// Helper: Generate actionable recommendations
function generateRecommendations(accuracyData: any[], scanData: any, feedbackData: any) {
  const recommendations: string[] = [];
  const totalScans = parseInt(scanData?.total_scans || 0);
  const totalFeedback = parseInt(feedbackData?.total_feedback || 0);

  // Data collection recommendations
  if (totalScans === 0) {
    recommendations.push('🚀 No scans yet - promote the widget to start collecting data');
  } else if (totalFeedback === 0) {
    recommendations.push('💬 Users are scanning but not giving feedback - make feedback buttons more prominent');
  } else if (totalFeedback < totalScans * 0.1) {
    recommendations.push('📊 Low feedback rate (<10%) - consider adding feedback prompts after scan');
  }

  // Accuracy-based recommendations
  for (const row of accuracyData) {
    const total = parseInt(row.total || 0);
    const corrections = parseInt(row.corrections || 0);
    if (total < 5) continue;

    const correctionRate = corrections / total;

    if (correctionRate > 0.5) {
      recommendations.push(`🔧 ${row.attribute}: Review detection thresholds (${(correctionRate*100).toFixed(0)}% users say it's wrong)`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('✨ System is performing well - continue collecting data');
  }

  return recommendations;
}

// Helper: Assess data health
function getDataHealthStatus(users: number, scans: number, feedback: number) {
  if (users === 0) return { status: 'empty', message: 'No users yet', color: 'gray' };
  if (scans === 0) return { status: 'starting', message: 'Users registered, awaiting scans', color: 'yellow' };
  if (feedback === 0) return { status: 'collecting', message: 'Scans happening, need feedback', color: 'orange' };
  if (feedback < 10) return { status: 'early', message: 'Early feedback stage', color: 'blue' };
  if (feedback < 50) return { status: 'growing', message: 'Building training dataset', color: 'green' };
  return { status: 'mature', message: 'Ready for model improvements', color: 'emerald' };
}

// =============================================================================
// SCAN CALIBRATION ROUTES - Auto-learning from scan data
// =============================================================================

/**
 * GET /api/maintenance/calibration
 * Get current calibration status and summary
 */
router.get('/calibration', async (req, res) => {
  try {
    const summary = await scanCalibrationService.getCalibrationSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/maintenance/calibration/reset
 * Reset and recalibrate all benchmarks from current scan data
 */
router.post('/calibration/reset', async (req, res) => {
  try {
    console.log('[Calibration] Manual reset triggered');
    const snapshot = await scanCalibrationService.resetBenchmarks();

    res.json({
      success: true,
      message: 'Benchmarks reset successfully',
      data: {
        id: snapshot.id,
        createdAt: snapshot.createdAt,
        totalScans: snapshot.totalScans,
        attributesCalibrated: snapshot.calibrations.length,
        calibrations: snapshot.calibrations.map(c => ({
          attribute: c.attribute,
          sampleSize: c.sampleSize,
          mean: c.mean,
          median: c.median,
          thresholds: c.thresholds
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maintenance/calibration/distribution
 * Get grade distribution across all scans (how many in each grade)
 */
router.get('/calibration/distribution', async (req, res) => {
  try {
    const distribution = await scanCalibrationService.getGradeDistribution();
    const benchmark = await scanCalibrationService.getLatestBenchmark();

    res.json({
      success: true,
      data: {
        lastCalibration: benchmark?.createdAt,
        distribution,
        explanation: {
          grade_0: 'None (bottom 20%)',
          grade_1: 'Mild (20-40%)',
          grade_2: 'Moderate (40-60%)',
          grade_3: 'Significant (60-80%)',
          grade_4: 'Severe (top 20%)'
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maintenance/calibration/thresholds/:attribute
 * Get calibrated thresholds for a specific attribute
 */
router.get('/calibration/thresholds/:attribute', async (req, res) => {
  try {
    const { attribute } = req.params;
    const thresholds = await scanCalibrationService.getThresholds(attribute);

    if (!thresholds) {
      return res.status(404).json({
        success: false,
        error: `No calibration data for ${attribute}. Run calibration first.`
      });
    }

    res.json({
      success: true,
      data: {
        attribute,
        thresholds,
        grades: {
          0: `score <= ${thresholds.none_max}`,
          1: `${thresholds.none_max} < score <= ${thresholds.mild_max}`,
          2: `${thresholds.mild_max} < score <= ${thresholds.moderate_max}`,
          3: `${thresholds.moderate_max} < score <= ${thresholds.significant_max}`,
          4: `score > ${thresholds.significant_max}`
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maintenance/calibration/analyze/:attribute
 * Analyze distribution for a specific attribute (without saving)
 */
router.get('/calibration/analyze/:attribute', async (req, res) => {
  try {
    const { attribute } = req.params;
    const analysis = await scanCalibrationService.analyzeDistribution(attribute);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: `Not enough data for ${attribute}. Need at least 10 scans.`
      });
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
