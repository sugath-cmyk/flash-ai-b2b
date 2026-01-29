import { Router } from 'express';
import multer from 'multer';
import * as faceScanController from '../controllers/face-scan.controller';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
    files: 3 // Max 3 files
  },
  fileFilter: (req, file, cb) => {
    // Only accept images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Face Scan Public API Routes
 * These endpoints are called by widgets (require API key via widget auth)
 */

// CORS middleware for all face scan routes
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, x-api-key');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check for face scan feature
router.get('/health', async (req, res) => {
  try {
    const { pool } = require('../config/database');

    // Check if face_scans table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'face_scans'
      );
    `);

    const tableExists = tableCheck.rows[0].exists;

    if (!tableExists) {
      return res.status(503).json({
        success: false,
        error: 'Face scan tables not initialized',
        message: 'Please run migration: 013_add_face_scan_tables.sql'
      });
    }

    // Check if we can insert/select (permission check)
    const testQuery = await pool.query('SELECT COUNT(*) FROM face_scans');

    res.json({
      success: true,
      status: 'Face scan feature ready',
      tableExists: true,
      recordCount: parseInt(testQuery.rows[0].count)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Face scan health check failed',
      message: error.message
    });
  }
});

// Debug endpoint - list recent face scans (for troubleshooting)
router.get('/debug/recent', async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const result = await pool.query(`
      SELECT id, store_id, visitor_id, status, created_at, completed_at, error_message
      FROM face_scans
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      scans: result.rows.map((row: any) => ({
        id: row.id,
        storeId: row.store_id,
        visitorId: row.visitor_id,
        status: row.status,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        errorMessage: row.error_message
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stats endpoint - get aggregate scan statistics
router.get('/stats', async (req, res) => {
  try {
    const { pool } = require('../config/database');

    // Get total scans and status breakdown
    const statusResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as today,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as this_week
      FROM face_scans
    `);

    // Get score distribution for completed scans
    const scoreResult = await pool.query(`
      SELECT
        AVG(acne_score)::integer as avg_acne,
        AVG(under_eye_darkness)::integer as avg_dark_circles,
        AVG(wrinkle_score)::integer as avg_wrinkles,
        AVG(pigmentation_score)::integer as avg_pigmentation,
        AVG(hydration_score)::integer as avg_hydration,
        AVG(texture_score)::integer as avg_texture,
        AVG(redness_score)::integer as avg_redness,
        MIN(acne_score) as min_acne, MAX(acne_score) as max_acne,
        MIN(under_eye_darkness) as min_dark_circles, MAX(under_eye_darkness) as max_dark_circles
      FROM face_analysis
    `);

    // Get recent score trends (last 20 scans)
    const recentScoresResult = await pool.query(`
      SELECT
        fa.acne_score,
        fa.under_eye_darkness as dark_circles_score,
        fa.wrinkle_score,
        fa.pigmentation_score,
        fs.created_at
      FROM face_scans fs
      JOIN face_analysis fa ON fs.id = fa.face_scan_id
      WHERE fs.status = 'completed'
      ORDER BY fs.created_at DESC
      LIMIT 20
    `);

    const stats = statusResult.rows[0];
    const scores = scoreResult.rows[0];
    const recentScores = recentScoresResult.rows;

    res.json({
      success: true,
      data: {
        totalScans: parseInt(stats.total),
        completed: parseInt(stats.completed),
        failed: parseInt(stats.failed),
        processing: parseInt(stats.processing),
        scansToday: parseInt(stats.today),
        scansThisWeek: parseInt(stats.this_week),
        successRate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) + '%' : '0%',
        averageScores: {
          acne: scores.avg_acne || 0,
          darkCircles: scores.avg_dark_circles || 0,
          wrinkles: scores.avg_wrinkles || 0,
          pigmentation: scores.avg_pigmentation || 0,
          hydration: scores.avg_hydration || 0,
          texture: scores.avg_texture || 0,
          redness: scores.avg_redness || 0
        },
        scoreRanges: {
          acne: { min: scores.min_acne, max: scores.max_acne },
          darkCircles: { min: scores.min_dark_circles, max: scores.max_dark_circles }
        },
        recentScores: recentScores.map((r: any) => ({
          acne: r.acne_score,
          darkCircles: r.dark_circles_score,
          wrinkles: r.wrinkle_score,
          pigmentation: r.pigmentation_score,
          date: r.created_at
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

// Test endpoint - get latest scan (for debugging without needing scanId)
router.get('/debug/latest', async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const result = await pool.query(`
      SELECT fs.*, fa.skin_tone, fa.skin_undertone, fa.skin_score
      FROM face_scans fs
      LEFT JOIN face_analysis fa ON fs.id = fa.face_scan_id
      ORDER BY fs.created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'No scans found', scan: null });
    }

    const scan = result.rows[0];
    res.json({
      success: true,
      scan: {
        id: scan.id,
        status: scan.status,
        storeId: scan.store_id,
        visitorId: scan.visitor_id,
        createdAt: scan.created_at,
        errorMessage: scan.error_message,
        analysis: scan.skin_tone ? {
          skinTone: scan.skin_tone,
          skinUndertone: scan.skin_undertone,
          skinScore: scan.skin_score
        } : null
      },
      testPollUrl: `/api/face-scan/${scan.id}`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upload face scan images
router.post('/upload', upload.array('images', 3), faceScanController.uploadFaceScan);

// Get face scan status and results
router.get('/:scanId', faceScanController.getFaceScan);

// Get product recommendations based on face analysis
router.post('/recommendations', faceScanController.getRecommendations);

// Track face scan events (analytics)
router.post('/track', faceScanController.trackEvent);

// ==========================================================================
// Skincare AI Conversation Endpoints
// ==========================================================================

import { skincareAIService } from '../services/skincare-ai.service';

// Start a skincare consultation conversation
router.post('/conversation/start', async (req, res) => {
  try {
    const { scanId, visitorId } = req.body;

    // Verify API key
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API key required' });
    }

    const widgetService = require('../services/widget.service').default;
    const { storeId, isValid } = await widgetService.verifyApiKey(apiKey);

    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    if (!scanId || !visitorId) {
      return res.status(400).json({ success: false, error: 'scanId and visitorId are required' });
    }

    const result = await skincareAIService.startConversation(scanId, visitorId, storeId);

    res.json({
      success: true,
      data: {
        conversationId: result.conversationId,
        message: result.message,
      }
    });
  } catch (error: any) {
    console.error('Start conversation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Continue skincare conversation with user message
router.post('/conversation/message', async (req, res) => {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId || !message) {
      return res.status(400).json({ success: false, error: 'conversationId and message are required' });
    }

    const result = await skincareAIService.continueConversation(conversationId, message);

    res.json({
      success: true,
      data: {
        message: result.message,
        isComplete: result.isComplete,
        canRevealResults: result.canRevealResults,
      }
    });
  } catch (error: any) {
    console.error('Continue conversation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// End skincare conversation and get collected info
router.post('/conversation/end', async (req, res) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'conversationId is required' });
    }

    const collectedInfo = skincareAIService.getCollectedInfo(conversationId);
    skincareAIService.endConversation(conversationId);

    res.json({
      success: true,
      data: {
        collectedInfo,
      }
    });
  } catch (error: any) {
    console.error('End conversation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's scan history (requires auth token)
router.get('/history', async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.substring(7);

    // Get user from token
    const userResult = await pool.query(
      `SELECT wu.id, wu.visitor_id FROM widget_users wu
       JOIN widget_auth_tokens wat ON wu.id = wat.user_id
       WHERE wat.token_hash = $1 AND wat.expires_at > NOW() AND wat.revoked_at IS NULL`,
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const user = userResult.rows[0];

    // Get user's scan history
    const scansResult = await pool.query(
      `SELECT fs.id, fs.created_at, fs.status, fa.skin_score, fa.skin_tone,
              fa.acne_score, fa.wrinkle_score, fa.pigmentation_score
       FROM face_scans fs
       LEFT JOIN face_analysis fa ON fs.id = fa.face_scan_id
       WHERE (fs.visitor_id = $1 OR fs.user_id = $2)
         AND fs.status = 'completed'
       ORDER BY fs.created_at DESC
       LIMIT 10`,
      [user.visitor_id, user.id]
    );

    res.json({
      success: true,
      scans: scansResult.rows.map((scan: any) => ({
        id: scan.id,
        created_at: scan.created_at,
        status: scan.status,
        skin_score: scan.skin_score,
        skin_tone: scan.skin_tone,
        acne_score: scan.acne_score,
        wrinkle_score: scan.wrinkle_score,
        pigmentation_score: scan.pigmentation_score
      }))
    });
  } catch (error: any) {
    console.error('Get scan history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
