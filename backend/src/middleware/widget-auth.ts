import { Request, Response, NextFunction } from 'express';
import widgetAuthService from '../services/widget-auth.service';
import { createError } from './errorHandler';

export interface WidgetAuthRequest extends Request {
  widgetUser?: {
    id: string;
    storeId: string;
  };
}

export const authenticateWidgetUser = async (
  req: WidgetAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw createError('Authentication token required', 401);
    }

    const { userId, storeId } = await widgetAuthService.verifyAccessToken(token);

    req.widgetUser = { id: userId, storeId };
    next();
  } catch (error: any) {
    if (error.message?.includes('expired')) {
      next(createError('Token expired', 401));
    } else if (error.message?.includes('Invalid')) {
      next(createError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

export const optionalWidgetAuth = async (
  req: WidgetAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const { userId, storeId } = await widgetAuthService.verifyAccessToken(token);
      req.widgetUser = { id: userId, storeId };
    }

    next();
  } catch (error) {
    // Silently continue without auth for optional routes
    next();
  }
};
