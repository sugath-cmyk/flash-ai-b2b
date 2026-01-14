import { Request, Response } from 'express';
import * as faceScanService from '../services/face-scan.service';

/**
 * Face Scan Controller
 * Handles face scanning and product recommendation endpoints
 */

/**
 * Upload face scan images
 * POST /api/face-scan/upload
 */
export async function uploadFaceScan(req: Request, res: Response) {
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

    if (!files || files.length < 1) {
      return res.status(400).json({
        success: false,
        error: 'At least 1 image required for face scanning'
      });
    }

    if (!visitorId) {
      return res.status(400).json({
        success: false,
        error: 'Visitor ID is required'
      });
    }

    // Create face scan record
    const scan = await faceScanService.createFaceScan({
      storeId,
      visitorId,
      status: 'processing'
    });

    // Process face scan via ML service (async)
    faceScanService.processFaceScan(scan.id, files).catch(error => {
      console.error('Face scan processing error:', error);
    });

    res.json({
      success: true,
      data: {
        scanId: scan.id,
        status: 'processing'
      }
    });
  } catch (error: any) {
    console.error('Upload face scan error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });

    res.status(500).json({
      success: false,
      error: 'Failed to upload face scan',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Get face scan status
 * GET /api/face-scan/:scanId
 */
export async function getFaceScan(req: Request, res: Response) {
  // Set CORS headers for widget access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, x-api-key');

  try {
    const { scanId } = req.params;
    console.log('[getFaceScan] ====== START ======');
    console.log('[getFaceScan] Raw scanId param:', scanId);
    console.log('[getFaceScan] scanId type:', typeof scanId);
    console.log('[getFaceScan] scanId length:', scanId?.length);
    console.log('[getFaceScan] Full URL:', req.originalUrl);
    console.log('[getFaceScan] Params:', JSON.stringify(req.params));

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scanId)) {
      console.log('[getFaceScan] Invalid UUID format:', scanId);
      return res.status(400).json({
        success: false,
        error: 'Invalid scan ID format',
        receivedId: scanId
      });
    }

    const scan = await faceScanService.getFaceScan(scanId);

    if (!scan) {
      console.log('[getFaceScan] Scan not found in database:', scanId);
      return res.status(404).json({
        success: false,
        error: 'Scan not found',
        scanId: scanId
      });
    }

    console.log('[getFaceScan] Found scan:', scan.id, 'status:', scan.status);
    console.log('[getFaceScan] ====== END ======');

    res.json({
      success: true,
      data: scan
    });
  } catch (error: any) {
    console.error('[getFaceScan] ERROR:', error.message);
    console.error('[getFaceScan] Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to get face scan',
      message: error.message
    });
  }
}

/**
 * Get product recommendations
 * POST /api/face-scan/recommendations
 */
export async function getRecommendations(req: Request, res: Response) {
  try {
    const { scanId } = req.body;

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

    if (!scanId) {
      return res.status(400).json({
        success: false,
        error: 'Scan ID is required'
      });
    }

    // Get recommendations
    const recommendations = await faceScanService.getProductRecommendations(scanId, storeId);

    res.json({
      success: true,
      data: {
        recommendations
      }
    });
  } catch (error: any) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations',
      message: error.message
    });
  }
}

/**
 * Track face scan event
 * POST /api/face-scan/track
 */
export async function trackEvent(req: Request, res: Response) {
  try {
    const { eventType, visitorId, scanId, sessionId, productId, metadata } = req.body;

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

    await faceScanService.trackFaceScanEvent({
      eventType,
      storeId,
      visitorId,
      faceScanId: scanId,
      sessionId,
      productId,
      metadata
    });

    res.json({
      success: true,
      message: 'Event tracked'
    });
  } catch (error: any) {
    console.error('Track face scan event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track event',
      message: error.message
    });
  }
}
