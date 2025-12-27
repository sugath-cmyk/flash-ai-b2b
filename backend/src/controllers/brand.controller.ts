import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import widgetService from '../services/widget.service';
import subscriptionService from '../services/subscription.service';
import widgetChatService from '../services/widget-chat.service';
import pool from '../config/database';

export class BrandController {
  // Public Products Endpoint (no auth required)
  async getPublicProducts(req: Request, res: Response) {
    console.log('=== START getPublicProducts ===');
    try {
      const { storeId } = req.params;
      console.log('📦 Store ID:', storeId);

      if (!storeId) {
        console.log('❌ No store ID provided');
        return res.status(400).json({
          success: false,
          error: 'Store ID is required',
        });
      }

      console.log('🔍 Running database query...');
      const result = await pool.query(
        `SELECT
          id,
          external_id,
          title,
          handle,
          description,
          vendor,
          product_type,
          sku,
          price,
          compare_at_price,
          inventory,
          status,
          tags,
          images,
          created_at
        FROM extracted_products
        WHERE store_id = $1 AND status = 'active'
        ORDER BY created_at DESC`,
        [storeId]
      );

      console.log('✅ Query complete. Found products:', result.rows.length);

      return res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error) {
      console.error('❌❌❌ ERROR in getPublicProducts:', error);
      console.error('Error stack:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch products',
        message: (error as Error).message,
      });
    } finally {
      console.log('=== END getPublicProducts ===');
    }
  }
  // Widget Configuration
  async getWidgetConfig(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      const config = await widgetService.getConfig(storeId, userId);

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      throw error;
    }
  }

  async updateWidgetConfig(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const config = req.body;

      const updated = await widgetService.updateConfig(storeId, userId, config);

      res.json({
        success: true,
        message: 'Widget configuration updated',
        data: updated,
      });
    } catch (error) {
      throw error;
    }
  }

  // API Keys
  async generateApiKey(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const { keyName } = req.body;

      const keys = await widgetService.generateApiKey(storeId, userId, keyName || 'default');

      res.json({
        success: true,
        message: 'API key generated. Save the secret - it will not be shown again!',
        data: keys,
      });
    } catch (error) {
      throw error;
    }
  }

  async getApiKeys(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      const keys = await widgetService.getApiKeys(storeId, userId);

      res.json({
        success: true,
        data: keys,
      });
    } catch (error) {
      throw error;
    }
  }

  // Analytics
  async getAnalytics(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const days = parseInt(req.query.days as string) || 30;

      // For admins, skip ownership check by passing the store's owner ID
      let analyticsUserId = userId;
      if (userRole === 'admin') {
        // Get the actual store owner
        const storeResult = await pool.query(
          'SELECT user_id FROM stores WHERE id = $1',
          [storeId]
        );
        if (storeResult.rows.length > 0) {
          analyticsUserId = storeResult.rows[0].user_id;
        }
      }

      const analytics = await widgetService.getAnalytics(storeId, analyticsUserId, days);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      throw error;
    }
  }

  // Embed Code
  async getEmbedCode(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      const embedCode = await widgetService.getEmbedCode(storeId, userId);

      res.json({
        success: true,
        data: { embedCode },
      });
    } catch (error) {
      throw error;
    }
  }

  // Subscriptions
  async getSubscription(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // For admins, get the store owner's userId
      let subscriptionUserId = userId;
      if (userRole === 'admin') {
        const storeResult = await pool.query(
          'SELECT user_id FROM stores WHERE id = $1',
          [storeId]
        );
        if (storeResult.rows.length > 0) {
          subscriptionUserId = storeResult.rows[0].user_id;
        }
      }

      const subscription = await subscriptionService.getSubscription(storeId, subscriptionUserId);

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      throw error;
    }
  }

  async updateSubscription(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const { planName, interval } = req.body;

      const subscription = await subscriptionService.updateSubscription(
        storeId,
        userId,
        planName,
        interval
      );

      res.json({
        success: true,
        message: 'Subscription updated',
        data: subscription,
      });
    } catch (error) {
      throw error;
    }
  }

  async cancelSubscription(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      const subscription = await subscriptionService.cancelSubscription(storeId, userId);

      res.json({
        success: true,
        message: 'Subscription canceled',
        data: subscription,
      });
    } catch (error) {
      throw error;
    }
  }

  async getAvailablePlans(req: AuthRequest, res: Response) {
    try {
      const plans = subscriptionService.getAvailablePlans();

      res.json({
        success: true,
        data: plans,
      });
    } catch (error) {
      throw error;
    }
  }

  async getInvoices(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      const invoices = await subscriptionService.getInvoices(storeId, userId);

      res.json({
        success: true,
        data: invoices,
      });
    } catch (error) {
      throw error;
    }
  }

  // Conversations
  async getConversations(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      // Verify store ownership
      const storeExtractionService = (await import('../services/store-extraction.service')).default;
      await storeExtractionService.getStoreDetails(storeId, userId);

      const conversations = await widgetChatService.getRecentConversations(storeId);

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      throw error;
    }
  }

  async getConversation(req: AuthRequest, res: Response) {
    try {
      const { storeId, conversationId } = req.params;
      const userId = req.user!.id;

      // Verify store ownership
      const storeExtractionService = (await import('../services/store-extraction.service')).default;
      await storeExtractionService.getStoreDetails(storeId, userId);

      const conversation = await widgetChatService.getConversation(conversationId, storeId);

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new BrandController();
