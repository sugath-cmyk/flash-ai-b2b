import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import storeExtractionService from '../services/store-extraction.service';
import { createError } from '../middleware/errorHandler';

export class StoreController {
  async initiateExtraction(req: AuthRequest, res: Response) {
    try {
      const { storeUrl, accessToken, apiKey, apiSecret } = req.body;
      const userId = req.user!.id;

      if (!storeUrl) {
        throw createError('Store URL is required', 400);
      }

      const result = await storeExtractionService.initiateExtraction({
        userId,
        storeUrl,
        accessToken,
        apiKey,
        apiSecret,
      });

      res.status(201).json({
        success: true,
        message: 'Store extraction initiated',
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  async getExtractionStatus(req: AuthRequest, res: Response) {
    try {
      const { jobId } = req.params;
      const userId = req.user!.id;

      const status = await storeExtractionService.getExtractionStatus(jobId, userId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      throw error;
    }
  }

  async getUserStores(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // If admin, return all stores; otherwise return user's stores
      const stores = userRole === 'admin'
        ? await storeExtractionService.getAllStores()
        : await storeExtractionService.getUserStores(userId);

      res.json({
        success: true,
        data: stores,
      });
    } catch (error) {
      throw error;
    }
  }

  async getStoreDetails(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Admin can access any store, brand owners only their own
      const store = userRole === 'admin'
        ? await storeExtractionService.getStoreDetailsAdmin(storeId)
        : await storeExtractionService.getStoreDetails(storeId, userId);

      res.json({
        success: true,
        data: store,
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteStore(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      await storeExtractionService.deleteStore(storeId, userId);

      res.json({
        success: true,
        message: 'Store deleted successfully',
      });
    } catch (error) {
      throw error;
    }
  }

  async retryExtraction(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      const result = await storeExtractionService.retryExtraction(storeId, userId);

      res.json({
        success: true,
        message: 'Extraction retry initiated',
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  async getStoreProducts(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // Verify store ownership
      const store = await storeExtractionService.getStoreDetails(storeId, userId);

      if (!store) {
        throw createError('Store not found', 404);
      }

      // Get products
      const { pool } = await import('../config/database');
      const result = await pool.query(
        `SELECT id, external_id, title, description, short_description, price,
                compare_at_price, currency, sku, product_type, vendor, handle,
                status, images, variants, tags, created_at
         FROM extracted_products
         WHERE store_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [storeId, limit, offset]
      );

      // Get total count
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM extracted_products WHERE store_id = $1',
        [storeId]
      );

      const totalCount = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalCount / limit);

      res.json({
        success: true,
        data: {
          products: result.rows,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages,
            hasMore: page < totalPages,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async getStoreCollections(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      // Verify store ownership
      const store = await storeExtractionService.getStoreDetails(storeId, userId);

      if (!store) {
        throw createError('Store not found', 404);
      }

      // Get collections
      const { pool } = await import('../config/database');
      const result = await pool.query(
        `SELECT id, external_id, title, description, handle, image_url,
                product_count, sort_order, created_at
         FROM extracted_collections
         WHERE store_id = $1
         ORDER BY created_at DESC`,
        [storeId]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      throw error;
    }
  }

  async getStorePages(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      // Verify store ownership
      const store = await storeExtractionService.getStoreDetails(storeId, userId);

      if (!store) {
        throw createError('Store not found', 404);
      }

      // Get pages
      const { pool } = await import('../config/database');
      const result = await pool.query(
        `SELECT id, page_type, title, content, url, handle, created_at
         FROM extracted_pages
         WHERE store_id = $1
         ORDER BY page_type, created_at DESC`,
        [storeId]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new StoreController();
