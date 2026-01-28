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
