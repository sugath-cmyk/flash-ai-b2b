import { Router } from 'express';
import routinesController from '../controllers/routines.controller';
import { authenticateWidgetUser } from '../middleware/widget-auth';

const router = Router();

// All routes require authentication
router.use(authenticateWidgetUser);

// POST /api/widget/routines/generate - Generate AM/PM routines based on goals
router.post('/generate', routinesController.generateRoutines.bind(routinesController));

// POST /api/widget/routines - Create a custom routine
router.post('/', routinesController.createRoutine.bind(routinesController));

// GET /api/widget/routines - Get user's routines
router.get('/', routinesController.getUserRoutines.bind(routinesController));

// GET /api/widget/routines/stats - Get routine statistics
router.get('/stats', routinesController.getStats.bind(routinesController));

// GET /api/widget/routines/logs - Get routine completion logs
router.get('/logs', routinesController.getRoutineLogs.bind(routinesController));

// GET /api/widget/routines/:routineId - Get specific routine
router.get('/:routineId', routinesController.getRoutineById.bind(routinesController));

// DELETE /api/widget/routines/:routineId - Delete a routine
router.delete('/:routineId', routinesController.deleteRoutine.bind(routinesController));

// POST /api/widget/routines/:routineId/steps - Add a step to routine
router.post('/:routineId/steps', routinesController.addStep.bind(routinesController));

// POST /api/widget/routines/:routineId/log - Log routine completion
router.post('/:routineId/log', routinesController.logCompletion.bind(routinesController));

// PATCH /api/widget/routines/steps/:stepId - Update a step
router.patch('/steps/:stepId', routinesController.updateStep.bind(routinesController));

// DELETE /api/widget/routines/steps/:stepId - Delete a step
router.delete('/steps/:stepId', routinesController.deleteStep.bind(routinesController));

export default router;
