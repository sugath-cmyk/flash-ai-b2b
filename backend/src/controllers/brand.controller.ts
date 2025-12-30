import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import widgetService from '../services/widget.service';
import subscriptionService from '../services/subscription.service';
import widgetChatService from '../services/widget-chat.service';
import adminQueryService from '../services/admin-query.service';
import queryCacheService from '../services/query-cache.service';
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

  // Shopify Credentials Management
  async getShopifyCredentials(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT shopify_shop_domain, shopify_access_token IS NOT NULL as has_token, shopify_scopes FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Store not found',
        });
      }

      const store = storeResult.rows[0];

      res.json({
        success: true,
        data: {
          shopDomain: store.shopify_shop_domain,
          hasToken: store.has_token,
          scopes: store.shopify_scopes ? store.shopify_scopes.split(',') : [],
          configured: !!store.has_token,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async saveShopifyCredentials(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const { shopDomain, accessToken, apiKey } = req.body;

      if (!shopDomain || !accessToken) {
        return res.status(400).json({
          success: false,
          message: 'Shop domain and access token are required',
        });
      }

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Store not found',
        });
      }

      // Test the credentials by making a Shopify API call
      const axios = (await import('axios')).default;
      try {
        await axios.get(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
          },
        });
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Shopify credentials. Please check your access token and shop domain.',
        });
      }

      // Save credentials
      await pool.query(
        `UPDATE stores
         SET shopify_shop_domain = $1,
             shopify_access_token = $2,
             shopify_installed_at = NOW(),
             sync_status = 'active',
             updated_at = NOW()
         WHERE id = $3`,
        [shopDomain, accessToken, storeId]
      );

      res.json({
        success: true,
        message: 'Shopify credentials saved successfully',
      });
    } catch (error) {
      throw error;
    }
  }

  async removeShopifyCredentials(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Store not found',
        });
      }

      // Remove credentials
      await pool.query(
        `UPDATE stores
         SET shopify_shop_domain = NULL,
             shopify_access_token = NULL,
             shopify_scopes = NULL,
             shopify_installed_at = NULL,
             sync_status = 'disconnected',
             updated_at = NOW()
         WHERE id = $1`,
        [storeId]
      );

      res.json({
        success: true,
        message: 'Shopify credentials removed successfully',
      });
    } catch (error) {
      throw error;
    }
  }

  // ============================================================================
  // QUERY ANALYTICS ENDPOINTS (For Brand Owners)
  // ============================================================================

  /**
   * Get query analytics dashboard summary
   * GET /api/brand/:storeId/query-analytics/summary
   */
  async getQueryAnalyticsSummary(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string) || 30;

      // Verify store ownership
      const storeExtractionService = (await import('../services/store-extraction.service')).default;
      await storeExtractionService.getStoreDetails(storeId, userId);

      // Get overall stats
      const stats = await adminQueryService.getQueryStats(storeId, days);

      // Get popular queries (top 5)
      const popularQueries = await adminQueryService.getPopularQueries(storeId, days, 5);

      // Get category breakdown
      const categories = await adminQueryService.getCategoryBreakdown(storeId, days);

      // Get cache stats
      const cacheStats = await queryCacheService.getCacheStats(storeId, days);

      res.json({
        success: true,
        data: {
          overview: {
            totalQueries: stats.totalQueries,
            uniqueConversations: stats.uniqueConversations,
            avgMessagesPerConversation: stats.avgMessagesPerConversation,
            cacheHitRate: stats.cacheHitRate,
            avgTokensPerQuery: stats.avgTokensPerQuery,
            timeRange: stats.timeRange
          },
          popularQueries: popularQueries.slice(0, 5),
          categoryBreakdown: categories,
          cachePerformance: {
            hitRate: cacheStats.cacheHitRate,
            totalCached: cacheStats.totalCachedResponses,
            savings: cacheStats.costSavings
          }
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get query statistics
   * GET /api/brand/:storeId/query-analytics/stats
   */
  async getQueryStats(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string) || 30;

      // Verify store ownership
      const storeExtractionService = (await import('../services/store-extraction.service')).default;
      await storeExtractionService.getStoreDetails(storeId, userId);

      const stats = await adminQueryService.getQueryStats(storeId, days);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get popular queries
   * GET /api/brand/:storeId/query-analytics/popular
   */
  async getPopularQueries(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string) || 30;
      const limit = parseInt(req.query.limit as string) || 20;
      const category = req.query.category as string | undefined;

      // Verify store ownership
      const storeExtractionService = (await import('../services/store-extraction.service')).default;
      await storeExtractionService.getStoreDetails(storeId, userId);

      const popularQueries = await adminQueryService.getPopularQueries(storeId, days, limit, category);

      res.json({
        success: true,
        data: {
          popularQueries,
          timeRange: {
            days,
            start: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString(),
            end: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category breakdown
   * GET /api/brand/:storeId/query-analytics/categories
   */
  async getCategoryBreakdown(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string) || 30;

      // Verify store ownership
      const storeExtractionService = (await import('../services/store-extraction.service')).default;
      await storeExtractionService.getStoreDetails(storeId, userId);

      const categories = await adminQueryService.getCategoryBreakdown(storeId, days);
      const totalQueries = categories.reduce((sum, cat) => sum + cat.count, 0);

      res.json({
        success: true,
        data: {
          categories,
          totalQueries,
          timeRange: {
            days,
            start: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString(),
            end: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search queries
   * GET /api/brand/:storeId/query-analytics/search
   */
  async searchQueries(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const {
        startDate,
        endDate,
        category,
        searchTerm,
        sentiment,
        page = '1',
        limit = '50'
      } = req.query;

      // Verify store ownership
      const storeExtractionService = (await import('../services/store-extraction.service')).default;
      await storeExtractionService.getStoreDetails(storeId, userId);

      const filters = {
        storeId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        category: category as string | undefined,
        searchTerm: searchTerm as string | undefined,
        sentiment: sentiment as string | undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const result = await adminQueryService.searchQueries(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export queries
   * GET /api/brand/:storeId/query-analytics/export
   */
  async exportQueries(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const {
        format = 'csv',
        startDate,
        endDate,
        category,
        searchTerm
      } = req.query;

      // Verify store ownership
      const storeExtractionService = (await import('../services/store-extraction.service')).default;
      await storeExtractionService.getStoreDetails(storeId, userId);

      if (format !== 'csv' && format !== 'json') {
        return res.status(400).json({
          success: false,
          message: 'format must be either "csv" or "json"'
        });
      }

      const filters = {
        storeId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        category: category as string | undefined,
        searchTerm: searchTerm as string | undefined
      };

      const exportData = await adminQueryService.exportQueries(filters, format as 'csv' | 'json');

      // Set appropriate headers
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `queries_export_${timestamp}.${format}`;

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }

      res.send(exportData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get cache statistics
   * GET /api/brand/:storeId/query-analytics/cache-stats
   */
  async getCacheStats(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string) || 30;

      // Verify store ownership
      const storeExtractionService = (await import('../services/store-extraction.service')).default;
      await storeExtractionService.getStoreDetails(storeId, userId);

      const cacheStats = await queryCacheService.getCacheStats(storeId, days);

      res.json({
        success: true,
        data: cacheStats
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new BrandController();
