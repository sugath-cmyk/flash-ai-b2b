import { Router } from 'express';
import authController, { registerValidation, loginValidation } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/register - User registration
router.post('/register', registerValidation, authController.register.bind(authController));

// POST /api/auth/login - User login
router.post('/login', loginValidation, authController.login.bind(authController));

// POST /api/auth/logout - User logout
router.post('/logout', authenticate, authController.logout.bind(authController));

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', authController.refresh.bind(authController));

// GET /api/auth/me - Get current user (protected route)
router.get('/me', authenticate, authController.getCurrentUser.bind(authController));

// GET /api/auth/google - Google OAuth
router.get('/google', (req, res) => {
  res.json({ message: 'Google OAuth - To be implemented' });
});

// GET /api/auth/google/callback - Google OAuth callback
router.get('/google/callback', (req, res) => {
  res.json({ message: 'Google OAuth callback - To be implemented' });
});

export default router;
