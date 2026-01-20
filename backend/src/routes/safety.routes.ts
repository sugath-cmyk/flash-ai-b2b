import { Router } from 'express';
import safetyController from '../controllers/safety.controller';
import { authenticateWidgetUser, optionalWidgetAuth } from '../middleware/widget-auth';

const router = Router();

// Public endpoints (no auth required)

// GET /api/widget/safety/common-allergens - Get list of common allergens
router.get('/common-allergens', safetyController.getCommonAllergens.bind(safetyController));

// POST /api/widget/safety/quick-check - Quick safety check without saving
router.post('/quick-check', safetyController.quickCheck.bind(safetyController));

// POST /api/widget/safety/check - Analyze ingredients (optional auth for personalization)
router.post('/check', optionalWidgetAuth, safetyController.checkIngredients.bind(safetyController));

// Protected endpoints (auth required)

// GET /api/widget/safety/preferences - Get user safety preferences
router.get('/preferences', authenticateWidgetUser, safetyController.getPreferences.bind(safetyController));

// PUT /api/widget/safety/preferences - Update user safety preferences
router.put('/preferences', authenticateWidgetUser, safetyController.updatePreferences.bind(safetyController));

// GET /api/widget/safety/allergens - Get user allergens
router.get('/allergens', authenticateWidgetUser, safetyController.getAllergens.bind(safetyController));

// POST /api/widget/safety/allergens - Add user allergen
router.post('/allergens', authenticateWidgetUser, safetyController.addAllergen.bind(safetyController));

// DELETE /api/widget/safety/allergens/:allergenId - Remove user allergen
router.delete('/allergens/:allergenId', authenticateWidgetUser, safetyController.removeAllergen.bind(safetyController));

// GET /api/widget/safety/history - Get scan history
router.get('/history', authenticateWidgetUser, safetyController.getScanHistory.bind(safetyController));

// GET /api/widget/safety/scans/:scanId - Get specific scan
router.get('/scans/:scanId', authenticateWidgetUser, safetyController.getScanById.bind(safetyController));

export default router;
