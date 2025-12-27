import { Request, Response } from 'express';
import { pool } from '../config/database';
import crypto from 'crypto';
import axios from 'axios';
import { AuthRequest } from '../middleware/auth';
import { SHOPIFY_SCOPES } from '../types/shopify.types';

/**
 * Shopify OAuth Controller
 * Handles Shopify app installation and authentication
 */

// Shopify OAuth Configuration
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || '';
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || '';
const SHOPIFY_REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URI || 'http://localhost:3000/api/shopify/callback';
const SHOPIFY_SCOPES_STRING = SHOPIFY_SCOPES.join(',');

/**
 * Step 1: Initiate Shopify OAuth Flow
 * Creates a state token and redirects user to Shopify authorization page
 */
export const initiateOAuth = async (req: AuthRequest, res: Response) => {
  try {
    const { shop } = req.query;
    const userId = req.user!.id;

    // Validate shop parameter
    if (!shop || typeof shop !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Shop domain is required (e.g., mystore.myshopify.com)',
      });
    }

    // Normalize shop domain (ensure .myshopify.com suffix)
    const shopDomain = shop.includes('.myshopify.com')
      ? shop
      : `${shop}.myshopify.com`;

    // Validate Shopify configuration
    if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Shopify app credentials not configured',
      });
    }

    // Generate secure state token (cryptographically random)
    const stateToken = crypto.randomBytes(32).toString('hex');

    // Store OAuth state in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      `INSERT INTO shopify_oauth_states
       (state_token, user_id, shop_domain, scopes, redirect_uri, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [stateToken, userId, shopDomain, SHOPIFY_SCOPES_STRING, SHOPIFY_REDIRECT_URI, expiresAt]
    );

    // Build Shopify OAuth authorization URL
    const authUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', SHOPIFY_CLIENT_ID);
    authUrl.searchParams.set('scope', SHOPIFY_SCOPES_STRING);
    authUrl.searchParams.set('redirect_uri', SHOPIFY_REDIRECT_URI);
    authUrl.searchParams.set('state', stateToken);

    // Return the authorization URL to the frontend
    res.json({
      success: true,
      redirectUrl: authUrl.toString(),
      message: 'Redirect to Shopify for authorization',
    });
  } catch (error: any) {
    console.error('Shopify OAuth initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Shopify connection',
      error: error.message,
    });
  }
};

/**
 * Step 2: Handle Shopify OAuth Callback
 * Verifies state token, exchanges authorization code for access token
 */
export const handleCallback = async (req: Request, res: Response) => {
  try {
    const { code, shop, state, hmac, timestamp } = req.query;

    // Validate required parameters
    if (!code || !shop || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing required OAuth parameters',
      });
    }

    // Verify HMAC signature (Shopify security requirement)
    if (!verifyShopifyHMAC(req.query as any)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid HMAC signature - request not from Shopify',
      });
    }

    // Retrieve and verify state token from database
    const stateResult = await pool.query(
      `SELECT * FROM shopify_oauth_states
       WHERE state_token = $1 AND used = false AND expires_at > NOW()`,
      [state]
    );

    if (stateResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired state token',
      });
    }

    const oauthState = stateResult.rows[0];
    const userId = oauthState.user_id;
    const shopDomain = shop as string;

    // Mark state token as used (prevent replay attacks)
    await pool.query(
      `UPDATE shopify_oauth_states SET used = true WHERE state_token = $1`,
      [state]
    );

    // Exchange authorization code for permanent access token
    const accessTokenResponse = await axios.post(
      `https://${shopDomain}/admin/oauth/access_token`,
      {
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code: code,
      }
    );

    const { access_token, scope } = accessTokenResponse.data;

    // Fetch shop details from Shopify
    const shopDetailsResponse = await axios.get(
      `https://${shopDomain}/admin/api/2024-01/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': access_token,
        },
      }
    );

    const shopDetails = shopDetailsResponse.data.shop;

    // Check if store already exists for this user
    const existingStoreResult = await pool.query(
      `SELECT id FROM stores WHERE user_id = $1 AND shopify_shop_domain = $2`,
      [userId, shopDomain]
    );

    let storeId: string;

    if (existingStoreResult.rows.length > 0) {
      // Update existing store
      storeId = existingStoreResult.rows[0].id;
      await pool.query(
        `UPDATE stores
         SET shopify_access_token = $1,
             shopify_scopes = $2,
             shopify_installed_at = NOW(),
             store_name = $3,
             domain = $4,
             platform = 'shopify',
             store_url = $5,
             sync_status = 'pending',
             metadata = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [
          access_token,
          scope,
          shopDetails.name,
          shopDetails.domain,
          `https://${shopDomain}`,
          JSON.stringify({
            currency: shopDetails.currency,
            timezone: shopDetails.timezone,
            email: shopDetails.email,
            phone: shopDetails.phone,
            plan_name: shopDetails.plan_name,
          }),
          storeId,
        ]
      );
    } else {
      // Create new store
      const newStoreResult = await pool.query(
        `INSERT INTO stores
         (user_id, platform, store_url, store_name, domain, shopify_shop_domain,
          shopify_access_token, shopify_scopes, shopify_installed_at, sync_status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
         RETURNING id`,
        [
          userId,
          'shopify',
          `https://${shopDomain}`,
          shopDetails.name,
          shopDetails.domain,
          shopDomain,
          access_token,
          scope,
          'pending',
          JSON.stringify({
            currency: shopDetails.currency,
            timezone: shopDetails.timezone,
            email: shopDetails.email,
            phone: shopDetails.phone,
            plan_name: shopDetails.plan_name,
          }),
        ]
      );
      storeId = newStoreResult.rows[0].id;

      // Create default widget config for new store
      await pool.query(
        `INSERT INTO widget_configs (store_id)
         VALUES ($1)
         ON CONFLICT (store_id) DO NOTHING`,
        [storeId]
      );
    }

    // Redirect to brand dashboard with success message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/brand/${storeId}?shopify_connected=true`);
  } catch (error: any) {
    console.error('Shopify OAuth callback error:', error);

    // Redirect to error page with message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorMessage = encodeURIComponent(error.message || 'Failed to connect Shopify store');
    res.redirect(`${frontendUrl}/brand/connect-store?error=${errorMessage}`);
  }
};

/**
 * Verify HMAC signature from Shopify
 * Ensures the request actually came from Shopify
 */
function verifyShopifyHMAC(query: any): boolean {
  const { hmac, ...params } = query;

  if (!hmac) {
    return false;
  }

  // Build message string from query parameters (sorted alphabetically)
  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  // Calculate HMAC-SHA256 signature
  const generatedHash = crypto
    .createHmac('sha256', SHOPIFY_CLIENT_SECRET)
    .update(message)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(generatedHash),
    Buffer.from(hmac as string)
  );
}

/**
 * Disconnect Shopify Store
 * Revokes access token and removes Shopify connection
 */
export const disconnectStore = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get store details
    const storeResult = await pool.query(
      `SELECT * FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    // Check permissions (owner or admin)
    if (store.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to disconnect this store',
      });
    }

    // Clear Shopify connection fields
    await pool.query(
      `UPDATE stores
       SET shopify_access_token = NULL,
           shopify_scopes = NULL,
           shopify_shop_domain = NULL,
           shopify_installed_at = NULL,
           sync_status = 'disconnected',
           updated_at = NOW()
       WHERE id = $1`,
      [storeId]
    );

    // Delete webhook subscriptions
    await pool.query(
      `DELETE FROM webhook_subscriptions WHERE store_id = $1`,
      [storeId]
    );

    res.json({
      success: true,
      message: 'Shopify store disconnected successfully',
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
 * Get Shopify Connection Status
 * Returns whether store is connected to Shopify and connection details
 */
export const getConnectionStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get store details
    const storeResult = await pool.query(
      `SELECT id, shopify_shop_domain, shopify_scopes, shopify_installed_at,
              sync_status, last_sync, auto_sync_enabled, sync_frequency
       FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    const isConnected = !!store.shopify_shop_domain;

    res.json({
      success: true,
      data: {
        connected: isConnected,
        shopDomain: store.shopify_shop_domain,
        scopes: store.shopify_scopes ? store.shopify_scopes.split(',') : [],
        installedAt: store.shopify_installed_at,
        syncStatus: store.sync_status,
        lastSync: store.last_sync,
        autoSyncEnabled: store.auto_sync_enabled,
        syncFrequency: store.sync_frequency,
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
