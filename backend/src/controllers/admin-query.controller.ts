import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import adminQueryService from '../services/admin-query.service';
import queryCacheService from '../services/query-cache.service';

/**
 * Admin Query Controller
 * Handles all admin analytics endpoints for query review and analysis
 */

export class AdminQueryController {
  /**
   * Search and filter queries
   * GET /api/admin/queries
   */
  async searchQueries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        storeId,
        startDate,
        endDate,
        category,
        searchTerm,
        sentiment,
        page = '1',
        limit = '50'
      } = req.query;

      if (!storeId) {
        res.status(400).json({
          success: false,
          message: 'storeId is required'
        });
        return;
      }

      const filters = {
        storeId: storeId as string,
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
    } catch (error: any) {
      console.error('Error in searchQueries:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search queries',
        error: error.message
      });
    }
  }

  /**
   * Get popular queries
   * GET /api/admin/queries/popular
   */
  async getPopularQueries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        storeId,
        days = '30',
        limit = '20',
        category
      } = req.query;

      if (!storeId) {
        res.status(400).json({
          success: false,
          message: 'storeId is required'
        });
        return;
      }

      const popularQueries = await adminQueryService.getPopularQueries(
        storeId as string,
        parseInt(days as string),
        parseInt(limit as string),
        category as string | undefined
      );

      res.json({
        success: true,
        data: {
          popularQueries,
          timeRange: {
            days: parseInt(days as string),
            start: new Date(Date.now() - (parseInt(days as string) * 24 * 60 * 60 * 1000)).toISOString(),
            end: new Date().toISOString()
          }
        }
      });
    } catch (error: any) {
      console.error('Error in getPopularQueries:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get popular queries',
        error: error.message
      });
    }
  }

  /**
   * Get category breakdown
   * GET /api/admin/queries/categories
   */
  async getCategoryBreakdown(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storeId, days = '30' } = req.query;

      if (!storeId) {
        res.status(400).json({
          success: false,
          message: 'storeId is required'
        });
        return;
      }

      const categories = await adminQueryService.getCategoryBreakdown(
        storeId as string,
        parseInt(days as string)
      );

      const totalQueries = categories.reduce((sum, cat) => sum + cat.count, 0);

      res.json({
        success: true,
        data: {
          categories,
          totalQueries,
          timeRange: {
            days: parseInt(days as string),
            start: new Date(Date.now() - (parseInt(days as string) * 24 * 60 * 60 * 1000)).toISOString(),
            end: new Date().toISOString()
          }
        }
      });
    } catch (error: any) {
      console.error('Error in getCategoryBreakdown:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get category breakdown',
        error: error.message
      });
    }
  }

  /**
   * Get overall query statistics
   * GET /api/admin/queries/stats
   */
  async getQueryStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storeId, days = '30' } = req.query;

      if (!storeId) {
        res.status(400).json({
          success: false,
          message: 'storeId is required'
        });
        return;
      }

      const stats = await adminQueryService.getQueryStats(
        storeId as string,
        parseInt(days as string)
      );

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Error in getQueryStats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get query statistics',
        error: error.message
      });
    }
  }

  /**
   * Get full conversation details
   * GET /api/admin/conversations/:id
   */
  async getConversationDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { storeId } = req.query;

      if (!storeId) {
        res.status(400).json({
          success: false,
          message: 'storeId is required'
        });
        return;
      }

      const conversation = await adminQueryService.getConversationDetails(
        id,
        storeId as string
      );

      res.json({
        success: true,
        data: conversation
      });
    } catch (error: any) {
      console.error('Error in getConversationDetails:', error);

      if (error.message === 'Conversation not found') {
        res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to get conversation details',
        error: error.message
      });
    }
  }

  /**
   * Export queries to CSV or JSON
   * GET /api/admin/queries/export
   */
  async exportQueries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        storeId,
        format = 'csv',
        startDate,
        endDate,
        category,
        searchTerm
      } = req.query;

      if (!storeId) {
        res.status(400).json({
          success: false,
          message: 'storeId is required'
        });
        return;
      }

      if (format !== 'csv' && format !== 'json') {
        res.status(400).json({
          success: false,
          message: 'format must be either "csv" or "json"'
        });
        return;
      }

      const filters = {
        storeId: storeId as string,
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
    } catch (error: any) {
      console.error('Error in exportQueries:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export queries',
        error: error.message
      });
    }
  }

  /**
   * Get cache statistics
   * GET /api/admin/queries/cache-stats
   */
  async getCacheStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storeId, days = '30' } = req.query;

      if (!storeId) {
        res.status(400).json({
          success: false,
          message: 'storeId is required'
        });
        return;
      }

      const cacheStats = await queryCacheService.getCacheStats(
        storeId as string,
        parseInt(days as string)
      );

      res.json({
        success: true,
        data: cacheStats
      });
    } catch (error: any) {
      console.error('Error in getCacheStats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get cache statistics',
        error: error.message
      });
    }
  }
}

export default new AdminQueryController();
