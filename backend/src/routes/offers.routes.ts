import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import offersController from '../controllers/offers.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all offers for a store (Shopify + manual)
router.get('/stores/:storeId/offers', offersController.getStoreOffers.bind(offersController));

// Get single offer details
router.get('/stores/:storeId/offers/:offerId', offersController.getOffer.bind(offersController));

// Create manual offer
router.post('/stores/:storeId/offers', offersController.createManualOffer.bind(offersController));

// Update manual offer
router.put('/stores/:storeId/offers/:offerId', offersController.updateOffer.bind(offersController));

// Toggle offer status
router.patch('/stores/:storeId/offers/:offerId/toggle', offersController.toggleOfferStatus.bind(offersController));

// Delete offer
router.delete('/stores/:storeId/offers/:offerId', offersController.deleteOffer.bind(offersController));

export default router;
