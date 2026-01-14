import { pool } from '../config/database';
import axios from 'axios';
import FormData from 'form-data';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Create body scan record in database
 */
export async function createBodyScan(data: {
  storeId: string;
  visitorId: string;
  status: string;
}) {
  const result = await pool.query(
    `INSERT INTO body_scans (store_id, visitor_id, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.storeId, data.visitorId, data.status]
  );
  return result.rows[0];
}

/**
 * Get body scan by ID
 */
export async function getBodyScan(scanId: string) {
  const result = await pool.query(
    `SELECT
      bs.*,
      bm.height_cm,
      bm.chest_cm,
      bm.waist_cm,
      bm.hips_cm,
      bm.inseam_cm,
      bm.shoulder_width_cm,
      bm.sleeve_length_cm,
      bm.neck_cm,
      bm.confidence_score
     FROM body_scans bs
     LEFT JOIN body_measurements bm ON bs.id = bm.body_scan_id
     WHERE bs.id = $1`,
    [scanId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    storeId: row.store_id,
    visitorId: row.visitor_id,
    status: row.status,
    imageUrls: row.image_urls,
    meshUrl: row.mesh_url,
    qualityScore: row.quality_score,
    processingTimeMs: row.processing_time_ms,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    measurements: row.height_cm ? {
      height_cm: row.height_cm,
      chest_cm: row.chest_cm,
      waist_cm: row.waist_cm,
      hips_cm: row.hips_cm,
      inseam_cm: row.inseam_cm,
      shoulder_width_cm: row.shoulder_width_cm,
      sleeve_length_cm: row.sleeve_length_cm,
      neck_cm: row.neck_cm,
      confidence_score: row.confidence_score
    } : null
  };
}

/**
 * Update body scan status and results
 */
export async function updateBodyScan(scanId: string, data: {
  status: string;
  meshUrl?: string;
  qualityScore?: number;
  processingTimeMs?: number;
  errorMessage?: string;
}) {
  const result = await pool.query(
    `UPDATE body_scans
     SET status = $1,
         mesh_url = COALESCE($2, mesh_url),
         quality_score = COALESCE($3, quality_score),
         processing_time_ms = COALESCE($4, processing_time_ms),
         error_message = $5,
         completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
     WHERE id = $6
     RETURNING *`,
    [data.status, data.meshUrl, data.qualityScore, data.processingTimeMs, data.errorMessage, scanId]
  );
  return result.rows[0];
}

/**
 * Save body measurements
 */
export async function saveBodyMeasurements(bodyScanId: string, measurements: any) {
  const result = await pool.query(
    `INSERT INTO body_measurements (
      body_scan_id, height_cm, chest_cm, waist_cm, hips_cm,
      inseam_cm, shoulder_width_cm, sleeve_length_cm, neck_cm, confidence_score
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (body_scan_id)
     DO UPDATE SET
       height_cm = EXCLUDED.height_cm,
       chest_cm = EXCLUDED.chest_cm,
       waist_cm = EXCLUDED.waist_cm,
       hips_cm = EXCLUDED.hips_cm,
       inseam_cm = EXCLUDED.inseam_cm,
       shoulder_width_cm = EXCLUDED.shoulder_width_cm,
       sleeve_length_cm = EXCLUDED.sleeve_length_cm,
       neck_cm = EXCLUDED.neck_cm,
       confidence_score = EXCLUDED.confidence_score
     RETURNING *`,
    [
      bodyScanId,
      measurements.height_cm,
      measurements.chest_cm,
      measurements.waist_cm,
      measurements.hips_cm,
      measurements.inseam_cm,
      measurements.shoulder_width_cm,
      measurements.sleeve_length_cm,
      measurements.neck_cm,
      measurements.confidence
    ]
  );
  return result.rows[0];
}

/**
 * Process body scan via ML service
 */
export async function processBodyScan(scanId: string, files: Express.Multer.File[]) {
  try {
    console.log(`Processing body scan ${scanId} with ${files.length} images`);

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('scan_id', scanId);

    // Add images to form data
    for (const file of files) {
      formData.append('images', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    }

    // Call ML service
    const response = await axios.post(
      `${ML_SERVICE_URL}/body-scan`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 60000 // 60 second timeout
      }
    );

    console.log('ML service response:', response.data);

    if (response.data.success) {
      // Update body scan with results
      await updateBodyScan(scanId, {
        status: 'completed',
        meshUrl: response.data.mesh_url,
        qualityScore: response.data.quality_score,
        processingTimeMs: response.data.processing_time_ms
      });

      // Save measurements
      await saveBodyMeasurements(scanId, response.data.measurements);

      console.log(`Body scan ${scanId} completed successfully`);
    } else {
      // Update with error
      await updateBodyScan(scanId, {
        status: 'failed',
        errorMessage: response.data.error || 'Processing failed'
      });
    }
  } catch (error: any) {
    console.error('Process body scan error:', error);

    // Update scan status to failed
    await updateBodyScan(scanId, {
      status: 'failed',
      errorMessage: error.message || 'ML service error'
    });
  }
}

/**
 * Create try-on session
 */
export async function createTryOnSession(data: {
  storeId: string;
  bodyScanId: string;
  productId: string;
  visitorId: string;
}) {
  const result = await pool.query(
    `INSERT INTO vto_sessions (store_id, body_scan_id, product_id, visitor_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.storeId, data.bodyScanId, data.productId, data.visitorId]
  );
  return result.rows[0];
}

/**
 * Get size recommendation from ML service
 */
export async function getSizeRecommendation(measurements: any, productId: string) {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/size-recommendation`,
      {
        measurements,
        product_id: productId
      },
      {
        timeout: 10000
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Get size recommendation error:', error);
    throw new Error('Failed to get size recommendation from ML service');
  }
}

/**
 * Track VTO event
 */
export async function trackEvent(data: {
  eventType: string;
  storeId: string;
  visitorId?: string;
  sessionId?: string;
  productId?: string;
  metadata?: any;
}) {
  await pool.query(
    `INSERT INTO vto_events (event_type, store_id, visitor_id, session_id, product_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.eventType,
      data.storeId,
      data.visitorId,
      data.sessionId,
      data.productId,
      data.metadata ? JSON.stringify(data.metadata) : null
    ]
  );
}
