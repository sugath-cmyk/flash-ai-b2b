import { Router } from 'express';
import brandController from '../controllers/brand.controller';
import { getWidgetConfig, updateWidgetConfig } from '../controllers/widget-config.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.get('/:storeId/products', brandController.getPublicProducts);

// All routes below require authentication
router.use(authenticate);

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

export default router;
