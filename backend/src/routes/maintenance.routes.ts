/**
 * Maintenance Routes
 * Automated maintenance endpoints for syncing, health checks, etc.
 */
import { Router } from 'express';
import maintenanceController from '../controllers/maintenance.controller';

const router = Router();

// Trigger Shopify sync (requires admin secret)
router.post('/sync/:storeId', maintenanceController.syncStore.bind(maintenanceController));

// Get products for verification (requires admin secret)
router.get('/products/:storeId', maintenanceController.getProducts.bind(maintenanceController));

// Get sync status (public)
router.get('/sync-status/:storeId', maintenanceController.getSyncStatus.bind(maintenanceController));

export default router;
