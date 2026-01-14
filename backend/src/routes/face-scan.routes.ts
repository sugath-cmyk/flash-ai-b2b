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

// Upload face scan images
router.post('/upload', upload.array('images', 3), faceScanController.uploadFaceScan);

// Get face scan status and results
router.get('/:scanId', faceScanController.getFaceScan);

// Get product recommendations based on face analysis
router.post('/recommendations', faceScanController.getRecommendations);

// Track face scan events (analytics)
router.post('/track', faceScanController.trackEvent);

export default router;
