import { Router } from 'express';
import vtoController, {
  uploadBodyScanValidation,
  startTryOnValidation,
  updateVTOSettingsValidation,
} from '../controllers/vto.controller';
import { authenticate, authenticateApiKey } from '../middleware/auth';

const router = Router();

// ============================================================================
// Widget API Endpoints (Public - authenticated via API key in X-API-Key header)
// ============================================================================

// Body scan endpoints
router.post(
  '/widget/body-scan/upload',
  authenticateApiKey,
  vtoController.uploadImages,
  uploadBodyScanValidation,
  vtoController.uploadBodyScan.bind(vtoController)
);

router.get(
  '/widget/body-scan/:scanId',
  authenticateApiKey,
  vtoController.getBodyScan.bind(vtoController)
);

// Try-on session endpoints
router.post(
  '/widget/try-on/start',
  authenticateApiKey,
  startTryOnValidation,
  vtoController.startTryOnSession.bind(vtoController)
);

router.put(
  '/widget/try-on/:sessionId/end',
  authenticateApiKey,
  vtoController.endSession.bind(vtoController)
);

router.post(
  '/widget/try-on/:sessionId/screenshot',
  authenticateApiKey,
  vtoController.saveScreenshot.bind(vtoController)
);

router.post(
  '/widget/try-on/:sessionId/share',
  authenticateApiKey,
  vtoController.shareSocial.bind(vtoController)
);

// Size recommendation
router.get(
  '/widget/size-recommendation',
  authenticateApiKey,
  vtoController.getSizeRecommendation.bind(vtoController)
);

// Conversion tracking webhook
router.post(
  '/widget/conversion',
  authenticateApiKey,
  vtoController.handleConversion.bind(vtoController)
);

// ============================================================================
// Brand Owner API Endpoints (Authenticated via JWT)
// ============================================================================

// VTO settings management
router.get(
  '/settings/:storeId',
  authenticate,
  vtoController.getVTOSettings.bind(vtoController)
);

router.put(
  '/settings/:storeId',
  authenticate,
  updateVTOSettingsValidation,
  vtoController.updateVTOSettings.bind(vtoController)
);

// Analytics
router.get(
  '/analytics/:storeId',
  authenticate,
  vtoController.getVTOAnalytics.bind(vtoController)
);

// ============================================================================
// Widget Script Injection (Public - no auth)
// ============================================================================

// Serve widget JavaScript
router.get(
  '/:storeId.js',
  vtoController.serveVTOWidget.bind(vtoController)
);

export default router;
