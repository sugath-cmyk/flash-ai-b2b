import { Router } from 'express';
import goalsController from '../controllers/goals.controller';
import { authenticateWidgetUser } from '../middleware/widget-auth';

const router = Router();

// GET /api/widget/goals/templates - Get all goal templates (public)
router.get('/templates', goalsController.getTemplates.bind(goalsController));

// GET /api/widget/goals/suggestions - Get personalized goal suggestions (protected)
router.get('/suggestions', authenticateWidgetUser, goalsController.getSuggestions.bind(goalsController));

// POST /api/widget/goals - Create a new goal (protected)
router.post('/', authenticateWidgetUser, goalsController.createGoal.bind(goalsController));

// GET /api/widget/goals - Get user's goals (protected)
router.get('/', authenticateWidgetUser, goalsController.getUserGoals.bind(goalsController));

// GET /api/widget/goals/:goalId - Get specific goal (protected)
router.get('/:goalId', authenticateWidgetUser, goalsController.getGoalById.bind(goalsController));

// PATCH /api/widget/goals/:goalId/status - Update goal status (protected)
router.patch('/:goalId/status', authenticateWidgetUser, goalsController.updateGoalStatus.bind(goalsController));

// DELETE /api/widget/goals/:goalId - Delete a goal (protected)
router.delete('/:goalId', authenticateWidgetUser, goalsController.deleteGoal.bind(goalsController));

export default router;
