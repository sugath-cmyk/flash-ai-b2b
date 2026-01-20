import { Router } from 'express';
import predictionController from '../controllers/prediction.controller';
import { authenticateWidgetUser } from '../middleware/widget-auth';

const router = Router();

// All prediction endpoints require authentication
router.use(authenticateWidgetUser);

// GET /api/widget/predictions/summary - Get overall progress summary with predictions
router.get('/summary', predictionController.getProgressSummary.bind(predictionController));

// GET /api/widget/predictions/goals - Get predictions for all active goals
router.get('/goals', predictionController.getAllGoalPredictions.bind(predictionController));

// POST /api/widget/predictions/goals/:goalId - Generate prediction for specific goal
router.post('/goals/:goalId', predictionController.generateGoalPrediction.bind(predictionController));

// GET /api/widget/predictions/goals/:goalId/saved - Get saved predictions for a goal
router.get('/goals/:goalId/saved', predictionController.getSavedPredictions.bind(predictionController));

// GET /api/widget/predictions/metric/:metric - Get prediction for a specific metric
router.get('/metric/:metric', predictionController.getMetricPrediction.bind(predictionController));

// POST /api/widget/predictions/face-preview - Generate face preview data
router.post('/face-preview', predictionController.generateFacePreview.bind(predictionController));

// GET /api/widget/predictions/face-previews - Get face preview history
router.get('/face-previews', predictionController.getFacePreviewHistory.bind(predictionController));

export default router;
