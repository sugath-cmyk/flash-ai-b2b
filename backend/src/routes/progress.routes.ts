import { Router } from 'express';
import progressController from '../controllers/progress.controller';
import { authenticateWidgetUser } from '../middleware/widget-auth';

const router = Router();

// All routes require widget user authentication
router.use(authenticateWidgetUser);

// GET /api/widget/progress/timeline - Get progress timeline
router.get('/timeline', progressController.getTimeline.bind(progressController));

// GET /api/widget/progress/latest - Get latest progress snapshot
router.get('/latest', progressController.getLatest.bind(progressController));

// GET /api/widget/progress/summary - Get progress summary with stats
router.get('/summary', progressController.getSummary.bind(progressController));

// GET /api/widget/progress/compare - Compare two specific scans
router.get('/compare', progressController.compareScans.bind(progressController));

// GET /api/widget/progress/compare-first - Compare latest with first scan
router.get('/compare-first', progressController.compareWithFirst.bind(progressController));

// GET /api/widget/progress/charts/:metric - Get chart data for a specific metric
router.get('/charts/:metric', progressController.getChartData.bind(progressController));

// GET /api/widget/progress/charts - Get all charts data
router.get('/charts', progressController.getAllChartsData.bind(progressController));

// GET /api/widget/progress/milestones - Get user milestones
router.get('/milestones', progressController.getMilestones.bind(progressController));

// POST /api/widget/progress/snapshot - Create a progress snapshot from a scan
router.post('/snapshot', progressController.createSnapshot.bind(progressController));

export default router;
