import { Router } from 'express';
import widgetAuthController, {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  verifyResetOTPValidation,
  resetPasswordValidation,
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

// ========== Password Reset Routes ==========

// POST /api/widget/auth/forgot-password - Request password reset OTP
router.post('/forgot-password', forgotPasswordValidation, widgetAuthController.forgotPassword.bind(widgetAuthController));

// POST /api/widget/auth/verify-reset-otp - Verify reset OTP and get reset token
router.post('/verify-reset-otp', verifyResetOTPValidation, widgetAuthController.verifyResetOTP.bind(widgetAuthController));

// POST /api/widget/auth/reset-password - Set new password with reset token
router.post('/reset-password', resetPasswordValidation, widgetAuthController.resetPassword.bind(widgetAuthController));

export default router;
