import { Request, Response } from 'express';
import * as vtoService from '../services/vto.service';

/**
 * VTO Controller
 * Handles Virtual Try-On endpoints
 */

/**
 * Upload body scan images
 * POST /api/vto/body-scan
 */
export async function uploadBodyScan(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];
    const { visitorId } = req.body;

    // Verify API key and get storeId
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    const widgetService = require('../services/widget.service').default;
    const { storeId, isValid } = await widgetService.verifyApiKey(apiKey);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    if (!files || files.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'At least 3 images required for body scanning'
      });
    }

    if (!visitorId) {
      return res.status(400).json({
        success: false,
        error: 'Visitor ID is required'
      });
    }

    // Create body scan record in database
    const scan = await vtoService.createBodyScan({
      storeId,
      visitorId,
      status: 'processing'
    });

    // Process body scan via ML service (async)
    vtoService.processBodyScan(scan.id, files).catch(error => {
      console.error('Body scan processing error:', error);
    });

    res.json({
      success: true,
      data: {
        scanId: scan.id,
        status: 'processing'
      }
    });
  } catch (error: any) {
    console.error('Upload body scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload body scan',
      message: error.message
    });
  }
}

/**
 * Get body scan status
 * GET /api/vto/body-scan/:scanId
 */
export async function getBodyScan(req: Request, res: Response) {
  try {
    const { scanId } = req.params;

    const scan = await vtoService.getBodyScan(scanId);

    if (!scan) {
      return res.status(404).json({
        success: false,
        error: 'Scan not found'
      });
    }

    res.json({
      success: true,
      data: scan
    });
  } catch (error: any) {
    console.error('Get body scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get body scan',
      message: error.message
    });
  }
}

/**
 * Start try-on session
 * POST /api/vto/try-on/start
 */
export async function startTryOnSession(req: Request, res: Response) {
  try {
    const { bodyScanId, productId, visitorId } = req.body;

    // Verify API key and get storeId
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    const widgetService = require('../services/widget.service').default;
    const { storeId, isValid } = await widgetService.verifyApiKey(apiKey);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    if (!bodyScanId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Body scan ID and product ID are required'
      });
    }

    // Verify body scan exists and is completed
    const scan = await vtoService.getBodyScan(bodyScanId);
    if (!scan || scan.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Invalid or incomplete body scan'
      });
    }

    // Create try-on session
    const session = await vtoService.createTryOnSession({
      storeId,
      bodyScanId,
      productId,
      visitorId
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        measurements: scan.measurements,
        meshUrl: scan.meshUrl
      }
    });
  } catch (error: any) {
    console.error('Start try-on session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start try-on session',
      message: error.message
    });
  }
}

/**
 * Get size recommendation
 * POST /api/vto/size-recommendation
 */
export async function getSizeRecommendation(req: Request, res: Response) {
  try {
    const { bodyScanId, productId } = req.body;

    if (!bodyScanId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Body scan ID and product ID are required'
      });
    }

    // Get measurements from body scan
    const scan = await vtoService.getBodyScan(bodyScanId);
    if (!scan || !scan.measurements) {
      return res.status(400).json({
        success: false,
        error: 'Body scan not found or missing measurements'
      });
    }

    // Get size recommendation from ML service
    const recommendation = await vtoService.getSizeRecommendation(
      scan.measurements,
      productId
    );

    res.json({
      success: true,
      data: recommendation
    });
  } catch (error: any) {
    console.error('Get size recommendation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get size recommendation',
      message: error.message
    });
  }
}

/**
 * Track VTO event
 * POST /api/vto/track
 */
export async function trackVTOEvent(req: Request, res: Response) {
  try {
    const { eventType, visitorId, sessionId, productId, metadata } = req.body;

    // Verify API key and get storeId
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    const widgetService = require('../services/widget.service').default;
    const { storeId, isValid } = await widgetService.verifyApiKey(apiKey);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'Event type is required'
      });
    }

    await vtoService.trackEvent({
      eventType,
      storeId,
      visitorId,
      sessionId,
      productId,
      metadata
    });

    res.json({
      success: true,
      message: 'Event tracked'
    });
  } catch (error: any) {
    console.error('Track VTO event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track event',
      message: error.message
    });
  }
}
