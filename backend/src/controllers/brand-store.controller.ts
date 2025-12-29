import { Request, Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { ShopifyAPIService, ShopifyExtractionService } from '../services/shopify-api.service';

/**
 * Brand Store Controller
 * Handles store connection and management for brand owners
 */

/**
 * Connect store with Shopify credentials
 * POST /api/brand/stores/connect
 *
 * Body:
 * {
 *   shopDomain: "mystore.myshopify.com",
 *   accessToken: "shpat_xxx..."
 * }
 */
export const connectStore = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { shopDomain, accessToken } = req.body;

    // Validate required fields
    if (!shopDomain || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Shop domain and access token are required',
      });
    }

    // Validate domain format
    if (!shopDomain.includes('.myshopify.com') && !shopDomain.includes('.')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop domain format. Expected: mystore.myshopify.com',
      });
    }

    // Clean domain (remove https://, trailing slashes, etc.)
    const cleanDomain = shopDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    console.log(`Attempting to connect store: ${cleanDomain}`);

    // Step 1: Test credentials by fetching shop info
    let shopInfo;
    try {
      const shopifyApi = new ShopifyAPIService(cleanDomain, accessToken);
      shopInfo = await shopifyApi.getShop();
      console.log(`✅ Successfully connected to shop: ${shopInfo.name}`);
    } catch (error: any) {
      console.error('Failed to connect to Shopify:', error.message);

      // Provide helpful error messages
      if (error.response?.status === 401) {
        return res.status(401).json({
          success: false,
          message: 'Invalid access token. Please check your Shopify Admin API credentials.',
          hint: 'Make sure the access token has not expired and has the required permissions.',
        });
      }

      if (error.response?.status === 404) {
        return res.status(404).json({
          success: false,
          message: 'Store not found. Please verify the shop domain is correct.',
          hint: 'Domain should be in format: mystore.myshopify.com',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Failed to connect to Shopify store',
        error: error.message,
        hint: 'Please verify your shop domain and access token are correct.',
      });
    }

    // Step 2: Check if store already exists
    const existingStore = await pool.query(
      `SELECT id, user_id, store_name FROM stores
       WHERE shopify_shop_domain = $1`,
      [cleanDomain]
    );

    let storeId;
    let isNewStore = false;

    if (existingStore.rows.length > 0) {
      const store = existingStore.rows[0];

      // Check if store belongs to another user
      if (store.user_id !== userId) {
        return res.status(409).json({
          success: false,
          message: 'This store is already connected to another account',
        });
      }

      // Update existing store
      storeId = store.id;
      await pool.query(
        `UPDATE stores
         SET shopify_access_token = $1,
             store_name = $2,
             domain = $3,
             platform = 'shopify',
             sync_status = 'pending',
             updated_at = NOW()
         WHERE id = $4`,
        [accessToken, shopInfo.name, shopInfo.domain, storeId]
      );

      console.log(`Updated existing store: ${storeId}`);
    } else {
      // Create new store
      isNewStore = true;
      const newStoreResult = await pool.query(
        `INSERT INTO stores
         (user_id, platform, store_name, domain, shopify_shop_domain,
          shopify_access_token, sync_status, metadata)
         VALUES ($1, 'shopify', $2, $3, $4, $5, 'pending', $6)
         RETURNING id`,
        [
          userId,
          shopInfo.name,
          shopInfo.domain,
          cleanDomain,
          accessToken,
          JSON.stringify({
            shopify_id: shopInfo.id,
            email: shopInfo.email,
            currency: shopInfo.currency,
            country: shopInfo.country_name,
            timezone: shopInfo.timezone,
          }),
        ]
      );

      storeId = newStoreResult.rows[0].id;
      console.log(`Created new store: ${storeId}`);

      // Generate widget API key for new store
      const crypto = require('crypto');
      const widgetApiKey = 'fa_' + crypto.randomBytes(16).toString('hex');

      await pool.query(
        `INSERT INTO widget_api_keys (store_id, key_name, api_key, is_active)
         VALUES ($1, 'default', $2, true)`,
        [storeId, widgetApiKey]
      );
    }

    // Step 3: Trigger background sync
    console.log(`Starting background sync for store ${storeId}...`);
    ShopifyExtractionService.extractStoreData(storeId).catch((error) => {
      console.error(`Background sync failed for store ${storeId}:`, error);
    });

    // Step 4: Return success response
    res.json({
      success: true,
      message: isNewStore
        ? 'Store connected successfully! Product sync has started.'
        : 'Store credentials updated successfully! Product sync has started.',
      data: {
        storeId,
        storeName: shopInfo.name,
        domain: shopInfo.domain,
        isNewStore,
        syncStatus: 'processing',
        shopInfo: {
          email: shopInfo.email,
          currency: shopInfo.currency,
          country: shopInfo.country_name || 'Unknown',
        },
      },
    });
  } catch (error: any) {
    console.error('Connect store error:', error);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while connecting the store',
      error: error.message,
    });
  }
};

/**
 * Get connection status for a store
 * GET /api/brand/stores/:storeId/connection
 */
export const getConnectionStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { storeId } = req.params;

    // Get store details
    const storeResult = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM extracted_products WHERE store_id = s.id) as product_count,
              (SELECT COUNT(*) FROM extracted_collections WHERE store_id = s.id) as collection_count
       FROM stores s
       WHERE s.id = $1 AND s.user_id = $2`,
      [storeId, userId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    // Get latest sync job
    const jobResult = await pool.query(
      `SELECT * FROM extraction_jobs
       WHERE store_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [storeId]
    );

    const latestJob = jobResult.rows[0] || null;

    // Determine connection status
    const isConnected = !!(store.shopify_shop_domain && store.shopify_access_token);
    const isSynced = store.sync_status === 'completed' && parseInt(store.product_count) > 0;

    res.json({
      success: true,
      data: {
        storeId: store.id,
        storeName: store.store_name,
        domain: store.domain,
        isConnected,
        isSynced,
        syncStatus: store.sync_status,
        lastSync: store.last_sync,
        productCount: parseInt(store.product_count),
        collectionCount: parseInt(store.collection_count),
        latestSyncJob: latestJob
          ? {
              status: latestJob.status,
              progress: latestJob.progress,
              totalItems: latestJob.total_items,
              itemsProcessed: latestJob.items_processed,
              startedAt: latestJob.started_at,
              completedAt: latestJob.completed_at,
              errorMessage: latestJob.error_message,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Get connection status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get connection status',
      error: error.message,
    });
  }
};

/**
 * Disconnect store (remove credentials)
 * DELETE /api/brand/stores/:storeId/connection
 */
export const disconnectStore = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { storeId } = req.params;

    // Verify ownership
    const storeResult = await pool.query(
      `SELECT id, store_name FROM stores WHERE id = $1 AND user_id = $2`,
      [storeId, userId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    // Remove Shopify credentials (keep store record and data)
    await pool.query(
      `UPDATE stores
       SET shopify_shop_domain = NULL,
           shopify_access_token = NULL,
           sync_status = 'disconnected',
           updated_at = NOW()
       WHERE id = $1`,
      [storeId]
    );

    res.json({
      success: true,
      message: 'Store disconnected successfully. Your data is preserved.',
    });
  } catch (error: any) {
    console.error('Disconnect store error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect store',
      error: error.message,
    });
  }
};

/**
 * Test Shopify credentials without saving
 * POST /api/brand/stores/test-connection
 */
export const testConnection = async (req: AuthRequest, res: Response) => {
  try {
    const { shopDomain, accessToken } = req.body;

    if (!shopDomain || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Shop domain and access token are required',
      });
    }

    const cleanDomain = shopDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    try {
      const shopifyApi = new ShopifyAPIService(cleanDomain, accessToken);
      const shopInfo = await shopifyApi.getShop();

      // Try to get product count, but don't fail if unavailable
      let productCount = 0;
      try {
        productCount = await shopifyApi.getProductCount();
      } catch (err) {
        console.log('Could not fetch product count:', err);
      }

      res.json({
        success: true,
        message: 'Connection successful!',
        data: {
          storeName: shopInfo.name,
          domain: shopInfo.domain,
          email: shopInfo.email,
          currency: shopInfo.currency,
          country: shopInfo.country_name || 'Unknown',
          productCount,
        },
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          hint: 'Please check your access token',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Connection failed',
        error: error.message,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Test connection failed',
      error: error.message,
    });
  }
};
