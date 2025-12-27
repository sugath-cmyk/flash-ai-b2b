import { Request, Response } from 'express';
import widgetService from '../services/widget.service';
import widgetChatService from '../services/widget-chat.service';
import subscriptionService from '../services/subscription.service';
import { createError } from '../middleware/errorHandler';

export class WidgetController {
  // Get widget configuration (public endpoint)
  async getConfig(req: Request, res: Response) {
    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        throw createError('API key required', 401);
      }

      const { storeId, isValid } = await widgetService.verifyApiKey(apiKey);

      if (!isValid) {
        throw createError('Invalid API key', 401);
      }

      // Get config without userId (public endpoint)
      const configResult = await widgetService.getConfigPublic(storeId);

      res.json({
        success: true,
        data: configResult,
      });
    } catch (error) {
      throw error;
    }
  }

  // Chat endpoint (public endpoint)
  async chat(req: Request, res: Response) {
    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        throw createError('API key required', 401);
      }

      const { storeId, isValid } = await widgetService.verifyApiKey(apiKey);

      if (!isValid) {
        throw createError('Invalid API key', 401);
      }

      // Check message limit
      const { allowed, remaining } = await subscriptionService.checkMessageLimit(storeId);

      if (!allowed) {
        throw createError('Message limit exceeded. Please upgrade your plan.', 429);
      }

      const { sessionId, visitorId, message, conversationId, productContext } = req.body;

      if (!sessionId || !message) {
        throw createError('Session ID and message are required', 400);
      }

      const response = await widgetChatService.chat({
        storeId,
        sessionId,
        visitorId,
        message,
        conversationId,
        productContext,
      });

      // Track message usage
      await subscriptionService.trackMessageUsage(storeId);

      res.json({
        success: true,
        data: response,
        meta: {
          messagesRemaining: remaining - 1,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  // Track analytics event (public endpoint)
  async trackEvent(req: Request, res: Response) {
    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        throw createError('API key required', 401);
      }

      const { storeId, isValid } = await widgetService.verifyApiKey(apiKey);

      if (!isValid) {
        throw createError('Invalid API key', 401);
      }

      const { eventType, eventData, sessionInfo } = req.body;

      if (!eventType || !sessionInfo) {
        throw createError('Event type and session info are required', 400);
      }

      await widgetService.trackEvent(storeId, eventType, eventData, sessionInfo);

      res.json({
        success: true,
        message: 'Event tracked',
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new WidgetController();
