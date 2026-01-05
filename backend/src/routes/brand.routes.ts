import { Router } from 'express';
import brandController from '../controllers/brand.controller';
import { getWidgetConfig, updateWidgetConfig } from '../controllers/widget-config.controller';
import {
  connectStore,
  getConnectionStatus,
  disconnectStore,
  testConnection,
} from '../controllers/brand-store.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.get('/:storeId/products', brandController.getPublicProducts);

// All routes below require authentication
router.use(authenticate);

/**
 * Store Connection & Management Routes
 * For brand owners to connect their Shopify stores
 */
// Test connection without saving
router.post('/stores/test-connection', testConnection);

// Connect store with credentials
router.post('/stores/connect', connectStore);

// Get connection status
router.get('/stores/:storeId/connection', getConnectionStatus);

// Disconnect store
router.delete('/stores/:storeId/connection', disconnectStore);

// Widget Configuration
router.get('/:storeId/widget/config', getWidgetConfig);
router.put('/:storeId/widget/config', updateWidgetConfig);

// API Keys
router.get('/:storeId/api-keys', brandController.getApiKeys);
router.post('/:storeId/api-keys', brandController.generateApiKey);

// Analytics
router.get('/:storeId/analytics', brandController.getAnalytics);

// Embed Code
router.get('/:storeId/embed-code', brandController.getEmbedCode);

// Subscriptions
router.get('/:storeId/subscription', brandController.getSubscription);
router.put('/:storeId/subscription', brandController.updateSubscription);
router.delete('/:storeId/subscription', brandController.cancelSubscription);
router.get('/plans', brandController.getAvailablePlans);

// Invoices
router.get('/:storeId/invoices', brandController.getInvoices);

// Conversations
router.get('/:storeId/conversations', brandController.getConversations);
router.get('/:storeId/conversations/:conversationId', brandController.getConversation);

// Shopify Credentials Management
router.get('/:storeId/shopify/credentials', brandController.getShopifyCredentials);
router.post('/:storeId/shopify/credentials', brandController.saveShopifyCredentials);
router.delete('/:storeId/shopify/credentials', brandController.removeShopifyCredentials);

// ============================================================================
// QUERY ANALYTICS ROUTES (For Brand Owners)
// ============================================================================

// Test endpoint to verify analytics routes are registered
router.get('/:storeId/query-analytics/test', (req, res) => {
  res.json({
    success: true,
    message: 'Query analytics routes are registered!',
    storeId: req.params.storeId,
    timestamp: new Date().toISOString()
  });
});

/**
 * Dashboard summary with overview, popular queries, categories, and cache stats
 * GET /api/brand/:storeId/query-analytics/summary?days=30
 */
router.get('/:storeId/query-analytics/summary', brandController.getQueryAnalyticsSummary);

/**
 * Overall query statistics
 * GET /api/brand/:storeId/query-analytics/stats?days=30
 */
router.get('/:storeId/query-analytics/stats', brandController.getQueryStats.bind(brandController));

/**
 * Popular queries (most frequently asked)
 * GET /api/brand/:storeId/query-analytics/popular?days=30&limit=20&category=ingredients
 */
router.get('/:storeId/query-analytics/popular', brandController.getPopularQueries.bind(brandController));

/**
 * Category breakdown with percentages
 * GET /api/brand/:storeId/query-analytics/categories?days=30
 */
router.get('/:storeId/query-analytics/categories', brandController.getCategoryBreakdown.bind(brandController));

/**
 * Search queries with filters
 * GET /api/brand/:storeId/query-analytics/search?category=ingredients&searchTerm=niacinamide&page=1&limit=50
 */
router.get('/:storeId/query-analytics/search', brandController.searchQueries.bind(brandController));

/**
 * Export queries as CSV or JSON
 * GET /api/brand/:storeId/query-analytics/export?format=csv&startDate=2024-01-01
 */
router.get('/:storeId/query-analytics/export', brandController.exportQueries.bind(brandController));

/**
 * Cache performance statistics
 * GET /api/brand/:storeId/query-analytics/cache-stats?days=30
 */
router.get('/:storeId/query-analytics/cache-stats', brandController.getCacheStats.bind(brandController));

export default router;
