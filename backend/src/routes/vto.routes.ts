import { Router } from 'express';
import multer from 'multer';
import * as vtoController from '../controllers/vto.controller';

const router = Router();

// Configure multer for memory storage (images will be sent to ML service)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
    files: 5 // Max 5 files
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
 * VTO Public API Routes
 * These endpoints are called by the VTO widget (require API key via widget auth)
 */

// Upload body scan images
router.post('/body-scan', upload.array('images', 5), vtoController.uploadBodyScan);

// Get body scan status
router.get('/body-scan/:scanId', vtoController.getBodyScan);

// Start try-on session
router.post('/try-on/start', vtoController.startTryOnSession);

// Get size recommendation
router.post('/size-recommendation', vtoController.getSizeRecommendation);

// Track VTO events (analytics)
router.post('/track', vtoController.trackVTOEvent);

export default router;
