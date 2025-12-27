import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import aiService from '../services/ai.service';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const chatValidation = [
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('conversationId').optional({ nullable: true }).isUUID().withMessage('Invalid conversation ID'),
  body('model').optional({ nullable: true }).isString().withMessage('Model must be a string'),
];

class AIController {
  async chat(req: AuthRequest, res: Response, next: NextFunction) {
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

      const { message, conversationId, model } = req.body;

      const result = await aiService.chat({
        conversationId,
        message,
        userId: req.user.id,
        teamId: undefined, // Team feature removed
        model,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const conversations = await aiService.getConversations(
        req.user.id,
        undefined // Team feature removed
      );

      res.json({
        success: true,
        data: { conversations },
      });
    } catch (error) {
      next(error);
    }
  }

  async getConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id } = req.params;
      const conversation = await aiService.getConversation(id, req.user.id);

      res.json({
        success: true,
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id } = req.params;
      await aiService.deleteConversation(id, req.user.id);

      res.json({
        success: true,
        message: 'Conversation deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateConversationTitle(req: AuthRequest, res: Response, next: NextFunction) {
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

      const { id } = req.params;
      const { title } = req.body;

      await aiService.updateConversationTitle(id, req.user.id, title);

      res.json({
        success: true,
        message: 'Conversation title updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AIController();
