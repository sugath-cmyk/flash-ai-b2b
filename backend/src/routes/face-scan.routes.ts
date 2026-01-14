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

// Upload face scan images
router.post('/upload', upload.array('images', 3), faceScanController.uploadFaceScan);

// Get face scan status and results
router.get('/:scanId', faceScanController.getFaceScan);

// Get product recommendations based on face analysis
router.post('/recommendations', faceScanController.getRecommendations);

// Track face scan events (analytics)
router.post('/track', faceScanController.trackEvent);

export default router;
