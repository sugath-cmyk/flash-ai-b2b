import { Router } from 'express';
import {
  initiateOAuth,
  handleCallback,
  disconnectStore,
  getConnectionStatus,
} from '../controllers/shopify-oauth.controller';
import {
  triggerSync,
  getSyncStatus,
  setupWebhooks,
  updateAutoSync,
  getSyncHistory,
} from '../controllers/store-management.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Shopify OAuth Routes
 */

// Step 1: Initiate OAuth flow
// GET /api/shopify/auth?shop=mystore.myshopify.com
router.get('/auth', authenticate, initiateOAuth);

// Step 2: OAuth callback (public - receives code from Shopify)
// GET /api/shopify/callback?code=...&shop=...&state=...&hmac=...
router.get('/callback', handleCallback);

// Get Shopify connection status for a store
// GET /api/shopify/stores/:storeId/status
router.get('/stores/:storeId/status', authenticate, getConnectionStatus);

// Disconnect Shopify store
// DELETE /api/shopify/stores/:storeId
router.delete('/stores/:storeId', authenticate, disconnectStore);

/**
 * Store Management Routes
 */

// Trigger manual sync
// POST /api/shopify/stores/:storeId/sync
router.post('/stores/:storeId/sync', authenticate, triggerSync);

// Get sync status
// GET /api/shopify/stores/:storeId/sync/status
router.get('/stores/:storeId/sync/status', authenticate, getSyncStatus);

// Get sync history
// GET /api/shopify/stores/:storeId/sync/history
router.get('/stores/:storeId/sync/history', authenticate, getSyncHistory);

// Setup webhooks
// POST /api/shopify/stores/:storeId/webhooks
router.post('/stores/:storeId/webhooks', authenticate, setupWebhooks);

// Update auto-sync settings
// PATCH /api/shopify/stores/:storeId/auto-sync
router.patch('/stores/:storeId/auto-sync', authenticate, updateAutoSync);

export default router;
