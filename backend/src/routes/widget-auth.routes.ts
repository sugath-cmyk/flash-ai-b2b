import { Router } from 'express';
import widgetAuthController, {
  registerValidation,
  loginValidation,
} from '../controllers/widget-auth.controller';
import { authenticateWidgetUser } from '../middleware/widget-auth';

const router = Router();

// POST /api/widget/auth/register - Widget user registration
router.post('/register', registerValidation, widgetAuthController.register.bind(widgetAuthController));

// POST /api/widget/auth/login - Widget user login
router.post('/login', loginValidation, widgetAuthController.login.bind(widgetAuthController));

// POST /api/widget/auth/refresh - Refresh access token
router.post('/refresh', widgetAuthController.refresh.bind(widgetAuthController));

// POST /api/widget/auth/logout - Widget user logout (protected)
router.post('/logout', authenticateWidgetUser, widgetAuthController.logout.bind(widgetAuthController));

// GET /api/widget/auth/me - Get current widget user (protected)
router.get('/me', authenticateWidgetUser, widgetAuthController.getCurrentUser.bind(widgetAuthController));

// PUT /api/widget/auth/profile - Update profile (protected)
router.put('/profile', authenticateWidgetUser, widgetAuthController.updateProfile.bind(widgetAuthController));

// POST /api/widget/auth/link-visitor - Link anonymous visitor to user (protected)
router.post('/link-visitor', authenticateWidgetUser, widgetAuthController.linkVisitor.bind(widgetAuthController));

export default router;
