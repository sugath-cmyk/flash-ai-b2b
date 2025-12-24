import { Router } from 'express';
import storeController from '../controllers/store.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Store extraction
router.post('/extract', storeController.initiateExtraction);
router.get('/jobs/:jobId', storeController.getExtractionStatus);
router.post('/:storeId/retry', storeController.retryExtraction);

// Store management
router.get('/', storeController.getUserStores);
router.get('/:storeId', storeController.getStoreDetails);
router.delete('/:storeId', storeController.deleteStore);

// Store data endpoints
router.get('/:storeId/products', storeController.getStoreProducts);
router.get('/:storeId/collections', storeController.getStoreCollections);
router.get('/:storeId/pages', storeController.getStorePages);

export default router;
