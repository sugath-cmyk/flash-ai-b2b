import { Router } from 'express';
import widgetController from '../controllers/widget.controller';

const router = Router();

// Public widget endpoints (authenticated via API key in header)
router.get('/config', widgetController.getConfig);
router.post('/chat', widgetController.chat);
router.post('/track', widgetController.trackEvent);

export default router;
