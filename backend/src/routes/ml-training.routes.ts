/**
 * ML Training Routes
 *
 * Routes for user feedback and admin ML management
 */

import { Router } from 'express';
import mlTrainingController from '../controllers/ml-training.controller';
import { authenticateWidgetUser } from '../middleware/widget-auth';

const router = Router();

// =============================================================================
// USER FEEDBACK ROUTES (Authenticated widget users)
// =============================================================================

/**
 * POST /api/ml/feedback
 * Submit detailed feedback on multiple attributes
 */
router.post('/feedback', authenticateWidgetUser, (req, res) =>
  mlTrainingController.submitFeedback(req, res)
);

/**
 * POST /api/ml/feedback/quick
 * Quick "This is correct" / "This is wrong" feedback
 */
router.post('/feedback/quick', authenticateWidgetUser, (req, res) =>
  mlTrainingController.submitQuickFeedback(req, res)
);

// =============================================================================
// ADMIN/INTERNAL ROUTES
// =============================================================================

/**
 * GET /api/ml/metrics
 * Get accuracy metrics for all attributes
 */
router.get('/metrics', (req, res) =>
  mlTrainingController.getAccuracyMetrics(req, res)
);

/**
 * GET /api/ml/dashboard
 * Get dashboard statistics
 */
router.get('/dashboard', (req, res) =>
  mlTrainingController.getDashboardStats(req, res)
);

/**
 * GET /api/ml/training-data
 * Export training data for model retraining
 * Query params: attribute, minConfidence, limit, excludeUsed
 */
router.get('/training-data', (req, res) =>
  mlTrainingController.getTrainingData(req, res)
);

/**
 * GET /api/ml/thresholds/:attribute
 * Get recommended threshold adjustments
 */
router.get('/thresholds/:attribute', (req, res) =>
  mlTrainingController.getThresholdRecommendations(req, res)
);

/**
 * POST /api/ml/expert-label
 * Submit expert/dermatologist label (admin only)
 */
router.post('/expert-label', (req, res) =>
  mlTrainingController.submitExpertLabel(req, res)
);

export default router;
