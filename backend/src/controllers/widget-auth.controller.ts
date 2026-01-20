import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import widgetAuthService from '../services/widget-auth.service';
import widgetService from '../services/widget.service';
import { createError } from '../middleware/errorHandler';

// Extend Request type for widget auth
export interface WidgetAuthRequest extends Request {
  widgetUser?: {
    id: string;
    storeId: string;
  };
}

export const registerValidation = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Valid phone number is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('visitorId').optional().trim(),
];

export const loginValidation = [
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional(),
  body('password').notEmpty().withMessage('Password is required'),
];

class WidgetAuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      // Verify API key and get store ID
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        throw createError('API key required', 401);
      }

      const { storeId, isValid } = await widgetService.verifyApiKey(apiKey);
      if (!isValid) {
        throw createError('Invalid API key', 401);
      }

      const { email, phone, password, firstName, lastName, visitorId } = req.body;

      if (!email && !phone) {
        throw createError('Email or phone is required', 400);
      }

      const result = await widgetAuthService.register({
        storeId,
        email,
        phone,
        password,
        firstName,
        lastName,
        visitorId,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Registration successful',
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      // Verify API key and get store ID
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        throw createError('API key required', 401);
      }

      const { storeId, isValid } = await widgetService.verifyApiKey(apiKey);
      if (!isValid) {
        throw createError('Invalid API key', 401);
      }

      const { email, phone, password } = req.body;

      if (!email && !phone) {
        throw createError('Email or phone is required', 400);
      }

      const result = await widgetAuthService.login({
        storeId,
        email,
        phone,
        password,
      });

      res.json({
        success: true,
        data: result,
        message: 'Login successful',
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw createError('Refresh token is required', 400);
      }

      const result = await widgetAuthService.refreshAccessToken(refreshToken);

      res.json({
        success: true,
        data: result,
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { refreshToken } = req.body;

      await widgetAuthService.logout(req.widgetUser.id, refreshToken);

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const user = await widgetAuthService.getUserById(req.widgetUser.id);

      if (!user) {
        throw createError('User not found', 404);
      }

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { firstName, lastName, displayName, avatarUrl, skinProfile, preferences } = req.body;

      const user = await widgetAuthService.updateProfile(req.widgetUser.id, {
        firstName,
        lastName,
        displayName,
        avatarUrl,
        skinProfile,
        preferences,
      });

      res.json({
        success: true,
        data: { user },
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async linkVisitor(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { visitorId } = req.body;

      if (!visitorId) {
        throw createError('Visitor ID is required', 400);
      }

      const result = await widgetAuthService.linkVisitor(req.widgetUser.id, visitorId);

      res.json({
        success: true,
        data: result,
        message: `Linked ${result.linked} previous scan(s) to your account`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new WidgetAuthController();
