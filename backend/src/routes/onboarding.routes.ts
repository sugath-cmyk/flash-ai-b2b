import { Router } from 'express';
import onboardingController, { submitOnboardingValidation } from '../controllers/onboarding.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public endpoint
router.post(
  '/submit',
  submitOnboardingValidation,
  onboardingController.submitOnboarding.bind(onboardingController)
);

// Admin endpoints
router.get(
  '/requests',
  authenticate,
  authorize('admin'),
  onboardingController.getAllRequests.bind(onboardingController)
);

router.get(
  '/requests/:id',
  authenticate,
  authorize('admin'),
  onboardingController.getRequest.bind(onboardingController)
);

router.put(
  '/requests/:id',
  authenticate,
  authorize('admin'),
  onboardingController.updateRequest.bind(onboardingController)
);

router.post(
  '/requests/:id/approve',
  authenticate,
  authorize('admin'),
  onboardingController.approveRequest.bind(onboardingController)
);

router.post(
  '/requests/:id/reject',
  authenticate,
  authorize('admin'),
  onboardingController.rejectRequest.bind(onboardingController)
);

router.delete(
  '/requests/:id',
  authenticate,
  authorize('admin'),
  onboardingController.deleteRequest.bind(onboardingController)
);

export default router;
