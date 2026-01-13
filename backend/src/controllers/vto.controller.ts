import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import vtoService from '../services/vto.service';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import multer from 'multer';
import path from 'path';

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
    }
  },
});

export const uploadBodyScanValidation = [
  body('visitorId').trim().notEmpty().withMessage('Visitor ID is required'),
];

export const startTryOnValidation = [
  body('bodyScanId').isUUID().withMessage('Valid body scan ID is required'),
  body('productId').trim().notEmpty().withMessage('Product ID is required'),
  body('visitorId').trim().notEmpty().withMessage('Visitor ID is required'),
];

export const updateVTOSettingsValidation = [
  body('enabled').optional().isBoolean().withMessage('Enabled must be boolean'),
  body('mode').optional().isIn(['floating', 'inline', 'both']).withMessage('Invalid mode'),
  body('button_position').optional().isString(),
  body('button_text').optional().isString().isLength({ max: 50 }),
  body('primary_color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color format'),
];

export class VTOController {
  // Middleware for handling image uploads
  uploadImages = upload.array('images', 10);

  // Widget API: Upload body scan images
  async uploadBodyScan(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 images are required for body scanning',
        });
      }

      const { visitorId } = req.body;
      const storeId = (req as any).apiKey?.storeId;

      if (!storeId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
        });
      }

      // Upload images to S3
      const imageBuffers = files.map(file => file.buffer);
      const imageUrls = await vtoService.uploadImagesToS3(imageBuffers, storeId);

      // Create body scan record
      const scan = await vtoService.createBodyScan({
        storeId,
        visitorId,
        imageUrls,
        status: 'pending',
      });

      // TODO: Call Go service to process body scan (async)
      // vtoGoClient.processBodyScan(scan.id, imageUrls);

      // Track event
      await vtoService.trackEvent({
        eventType: 'body_scan_started',
        storeId,
        visitorId,
        metadata: { scanId: scan.id, imageCount: imageUrls.length },
      });

      res.json({
        success: true,
        data: {
          scanId: scan.id,
          status: 'processing',
          message: 'Body scan is being processed',
        },
      });
    } catch (error) {
      console.error('Upload body scan error:', error);
      throw error;
    }
  }

  // Widget API: Get body scan status and results
  async getBodyScan(req: Request, res: Response) {
    try {
      const { scanId } = req.params;

      const result = await vtoService.getBodyScanWithMeasurements(scanId);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Body scan not found',
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get body scan error:', error);
      throw error;
    }
  }

  // Widget API: Start try-on session
  async startTryOnSession(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { bodyScanId, productId, variantId, visitorId } = req.body;
      const storeId = (req as any).apiKey?.storeId;

      if (!storeId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
        });
      }

      // Validate body scan exists and is completed
      const scanResult = await vtoService.getBodyScanWithMeasurements(bodyScanId);
      if (!scanResult || scanResult.scan.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Body scan is not completed or does not exist',
        });
      }

      // Create try-on session
      const session = await vtoService.createTryOnSession({
        storeId,
        bodyScanId,
        productId,
        variantId,
        visitorId,
      });

      // TODO: Call Go service to initialize rendering
      // const renderData = await vtoGoClient.initializeTryOn(scanResult.scan.mesh_url!, productId);

      // Mock render data for now
      const renderData = {
        body_mesh_url: scanResult.scan.mesh_url!,
        garment_mesh_url: null, // Would come from product data
        initial_pose: null,
      };

      // Track event
      await vtoService.trackEvent({
        eventType: 'try_on_started',
        storeId,
        visitorId,
        sessionId: session.id,
        productId,
        variantId,
      });

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          renderData,
        },
      });
    } catch (error) {
      console.error('Start try-on error:', error);
      throw error;
    }
  }

  // Widget API: Save screenshot from try-on session
  async saveScreenshot(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const { imageData } = req.body; // Base64 image data

      // Update session
      await vtoService.updateVTOSession(sessionId, {
        screenshotTaken: true,
      });

      // Get session to track event
      const session = await vtoService.getVTOSession(sessionId);
      if (session) {
        await vtoService.trackEvent({
          eventType: 'screenshot_taken',
          storeId: session.store_id,
          visitorId: session.visitor_id,
          sessionId: session.id,
          productId: session.product_id || undefined,
        });
      }

      res.json({
        success: true,
        message: 'Screenshot saved',
      });
    } catch (error) {
      console.error('Save screenshot error:', error);
      throw error;
    }
  }

  // Widget API: Share try-on on social media
  async shareSocial(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const { platform } = req.body; // 'facebook', 'instagram', 'twitter', etc.

      // Update session
      await vtoService.updateVTOSession(sessionId, {
        sharedSocial: true,
      });

      // Get session to track event
      const session = await vtoService.getVTOSession(sessionId);
      if (session) {
        await vtoService.trackEvent({
          eventType: 'social_shared',
          storeId: session.store_id,
          visitorId: session.visitor_id,
          sessionId: session.id,
          productId: session.product_id || undefined,
          metadata: { platform },
        });
      }

      res.json({
        success: true,
        message: 'Shared successfully',
      });
    } catch (error) {
      console.error('Share social error:', error);
      throw error;
    }
  }

  // Widget API: Get size recommendation
  async getSizeRecommendation(req: Request, res: Response) {
    try {
      const { bodyScanId, productId } = req.query;

      if (!bodyScanId || !productId) {
        return res.status(400).json({
          success: false,
          error: 'Body scan ID and product ID are required',
        });
      }

      // Get measurements
      const measurements = await vtoService.getBodyMeasurements(bodyScanId as string);

      if (!measurements) {
        return res.status(404).json({
          success: false,
          error: 'Body measurements not found',
        });
      }

      // TODO: Call Go service for size recommendation
      // const recommendation = await vtoGoClient.getSizeRecommendation(measurements, productId as string);

      // Mock recommendation for now
      const recommendation = {
        recommended_size: 'M',
        confidence: 0.85,
        all_sizes: {
          S: 0.10,
          M: 0.85,
          L: 0.05,
        },
        fit_advice: 'This size should fit you perfectly based on your measurements.',
      };

      // Save recommendation
      await vtoService.createSizeRecommendation({
        bodyScanId: bodyScanId as string,
        productId: productId as string,
        recommendedSize: recommendation.recommended_size,
        confidence: recommendation.confidence,
        allSizes: recommendation.all_sizes,
        fitAdvice: recommendation.fit_advice,
      });

      res.json({
        success: true,
        data: recommendation,
      });
    } catch (error) {
      console.error('Get size recommendation error:', error);
      throw error;
    }
  }

  // Brand Owner API: Get VTO settings
  async getVTOSettings(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;

      // TODO: Verify user owns this store
      let settings = await vtoService.getVTOSettings(storeId);

      // Create default settings if not found
      if (!settings) {
        settings = await vtoService.createDefaultVTOSettings(storeId);
      }

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error('Get VTO settings error:', error);
      throw error;
    }
  }

  // Brand Owner API: Update VTO settings
  async updateVTOSettings(req: AuthRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { storeId } = req.params;

      // TODO: Verify user owns this store

      // Ensure settings exist
      let settings = await vtoService.getVTOSettings(storeId);
      if (!settings) {
        settings = await vtoService.createDefaultVTOSettings(storeId);
      }

      // Update settings
      const updated = await vtoService.updateVTOSettings(storeId, req.body);

      res.json({
        success: true,
        message: 'VTO settings updated',
        data: updated,
      });
    } catch (error) {
      console.error('Update VTO settings error:', error);
      throw error;
    }
  }

  // Brand Owner API: Get VTO analytics
  async getVTOAnalytics(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const { startDate, endDate } = req.query;

      // TODO: Verify user owns this store

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await vtoService.getVTOAnalytics(storeId, start, end);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Get VTO analytics error:', error);
      throw error;
    }
  }

  // Widget script injection
  async serveVTOWidget(req: Request, res: Response) {
    try {
      const { storeId } = req.params;

      // Get VTO settings
      const settings = await vtoService.getVTOSettings(storeId);

      if (!settings || !settings.enabled) {
        return res.status(404).send('// VTO widget not enabled for this store');
      }

      // Generate widget script
      const widgetScript = `
(function() {
  'use strict';

  // VTO Widget Configuration
  window.FLASHAI_VTO_CONFIG = {
    storeId: '${storeId}',
    apiBaseUrl: '${process.env.API_BASE_URL || 'https://flash-ai-backend.onrender.com'}/api/vto',
    mode: '${settings.mode}',
    buttonPosition: '${settings.button_position}',
    buttonText: '${settings.button_text}',
    primaryColor: '${settings.primary_color}'
  };

  // Load VTO widget script
  var script = document.createElement('script');
  script.src = '${process.env.CDN_URL || 'https://cdn.flash-ai.com'}/vto-widget.js';
  script.async = true;
  document.body.appendChild(script);
})();
      `;

      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
      res.send(widgetScript);
    } catch (error) {
      console.error('Serve VTO widget error:', error);
      res.status(500).send('// Error loading VTO widget');
    }
  }

  // Webhook: Handle conversion events from store
  async handleConversion(req: Request, res: Response) {
    try {
      const { sessionId, orderId, productId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required',
        });
      }

      // Update session as converted
      const session = await vtoService.getVTOSession(sessionId);
      if (session) {
        await vtoService.updateVTOSession(sessionId, {
          converted: true,
        });

        // Track conversion event
        await vtoService.trackEvent({
          eventType: 'purchase_completed',
          storeId: session.store_id,
          visitorId: session.visitor_id,
          sessionId: session.id,
          productId: productId || session.product_id || undefined,
          metadata: { orderId },
        });
      }

      res.json({
        success: true,
        message: 'Conversion tracked',
      });
    } catch (error) {
      console.error('Handle conversion error:', error);
      throw error;
    }
  }

  // End try-on session
  async endSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const { durationSeconds, garmentsTried } = req.body;

      const session = await vtoService.updateVTOSession(sessionId, {
        durationSeconds,
        garmentsTried,
      });

      await vtoService.endVTOSession(sessionId);

      // Track event
      if (session) {
        await vtoService.trackEvent({
          eventType: 'try_on_ended',
          storeId: session.store_id,
          visitorId: session.visitor_id,
          sessionId: session.id,
          metadata: {
            durationSeconds,
            garmentsTried,
          },
        });
      }

      res.json({
        success: true,
        message: 'Session ended',
      });
    } catch (error) {
      console.error('End session error:', error);
      throw error;
    }
  }
}

export default new VTOController();
