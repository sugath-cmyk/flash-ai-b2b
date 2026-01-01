import { Request, Response } from 'express';
import widgetService from '../services/widget.service';
import widgetChatService from '../services/widget-chat.service';
import subscriptionService from '../services/subscription.service';
import { createError } from '../middleware/errorHandler';
import * as fs from 'fs';
import * as path from 'path';

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

  // Serve widget JavaScript file (public endpoint)
  async serveWidgetScript(req: Request, res: Response) {
    try {
      const { storeId } = req.params;

      if (!storeId) {
        throw createError('Store ID is required', 400);
      }

      // Get API key for this store
      const apiKeys = await widgetService.getActiveApiKey(storeId);

      if (!apiKeys || apiKeys.length === 0) {
        throw createError('No API key found for this store', 404);
      }

      const apiKey = apiKeys[0].api_key;

      // Read widget template
      const templatePath = path.join(__dirname, '../public/widget-template.js');
      let widgetScript = fs.readFileSync(templatePath, 'utf8');

      // Get API base URL from environment or default
      const apiBaseUrl = process.env.API_BASE_URL || 'https://flash-ai-backend-rld7.onrender.com';

      // Replace placeholders
      widgetScript = widgetScript.replace('{{API_BASE_URL}}', apiBaseUrl);
      widgetScript = widgetScript.replace('{{API_KEY}}', apiKey);

      // Set appropriate headers for cross-origin loading
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // Disable caching during development
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow from any origin
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Widget-Version', 'v1.3.0-regex-fix'); // Updated version

      res.send(widgetScript);
    } catch (error) {
      console.error('Error serving widget script:', error);
      throw error;
    }
  }
}

export default new WidgetController();
