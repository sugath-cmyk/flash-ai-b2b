import { Router } from 'express';
import feedbackController from '../controllers/feedback.controller';
import { authenticateWidgetUser } from '../middleware/widget-auth';

const router = Router();

// Public endpoints (no auth required)

// GET /api/widget/feedback/product/:productId/stats - Get product feedback stats
router.get('/product/:productId/stats', feedbackController.getProductStats.bind(feedbackController));

// GET /api/widget/feedback/insights - Get aggregated insights
router.get('/insights', feedbackController.getInsights.bind(feedbackController));

// Protected endpoints (auth required)

// POST /api/widget/feedback - Record explicit feedback
router.post('/', authenticateWidgetUser, feedbackController.recordFeedback.bind(feedbackController));

// POST /api/widget/feedback/signal - Record behavior signal
router.post('/signal', authenticateWidgetUser, feedbackController.recordSignal.bind(feedbackController));

// GET /api/widget/feedback - Get user's feedback history
router.get('/', authenticateWidgetUser, feedbackController.getUserFeedback.bind(feedbackController));

// GET /api/widget/feedback/saved - Get user's saved products
router.get('/saved', authenticateWidgetUser, feedbackController.getSavedProducts.bind(feedbackController));

// DELETE /api/widget/feedback/saved/:productId - Remove saved product
router.delete('/saved/:productId', authenticateWidgetUser, feedbackController.removeSavedProduct.bind(feedbackController));

// GET /api/widget/feedback/purchased - Get user's purchased products
router.get('/purchased', authenticateWidgetUser, feedbackController.getPurchasedProducts.bind(feedbackController));

// GET /api/widget/feedback/pending-effectiveness - Get pending effectiveness feedback
router.get('/pending-effectiveness', authenticateWidgetUser, feedbackController.getPendingEffectiveness.bind(feedbackController));

// POST /api/widget/feedback/personalized-boosts - Get personalized boosts for products
router.post('/personalized-boosts', authenticateWidgetUser, feedbackController.getPersonalizedBoosts.bind(feedbackController));

// GET /api/widget/feedback/weights - Get adjusted recommendation weights
router.get('/weights', authenticateWidgetUser, feedbackController.getAdjustedWeights.bind(feedbackController));

// GET /api/widget/feedback/store-summary - Get store feedback summary
router.get('/store-summary', authenticateWidgetUser, feedbackController.getStoreSummary.bind(feedbackController));

// GET /api/widget/feedback/performance - Get recommendation performance metrics
router.get('/performance', authenticateWidgetUser, feedbackController.getPerformance.bind(feedbackController));

export default router;
