import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import userController, {
  updateProfileValidation,
  changePasswordValidation,
} from '../controllers/user.controller';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /api/users/me - Get current user profile
router.get('/me', userController.getProfile.bind(userController));

// PUT /api/users/me - Update current user profile
router.put('/me', updateProfileValidation, userController.updateProfile.bind(userController));

// PUT /api/users/me/password - Change password
router.put('/me/password', changePasswordValidation, userController.changePassword.bind(userController));

export default router;
