import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import userService from '../services/user.service';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const updateProfileValidation = [
  body('first_name').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
];

export const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
];

class UserController {
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const profile = await userService.getUserProfile(req.user.id);

      res.json({
        success: true,
        data: { user: profile },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { first_name, last_name, email } = req.body;
      const updatedUser = await userService.updateUserProfile(req.user.id, {
        first_name,
        last_name,
        email,
      });

      res.json({
        success: true,
        data: { user: updatedUser },
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { currentPassword, newPassword } = req.body;
      await userService.changePassword(req.user.id, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
