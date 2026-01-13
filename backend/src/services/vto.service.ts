import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  VTOSettings,
  BodyScan,
  BodyMeasurements,
  VTOSession,
  VTOEvent,
  SizeRecommendation,
  CreateBodyScanRequest,
  UpdateVTOSettingsRequest,
  VTOAnalyticsResponse,
} from '../types/vto.types';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET = process.env.S3_BUCKET || 'flash-ai-vto';

export class VTOService {
  // VTO Settings Management

  async getVTOSettings(storeId: string): Promise<VTOSettings | null> {
    const result = await pool.query(
      `SELECT * FROM vto_settings WHERE store_id = $1`,
      [storeId]
    );

    return result.rows[0] || null;
  }

  async createDefaultVTOSettings(storeId: string): Promise<VTOSettings> {
    const result = await pool.query(
      `INSERT INTO vto_settings (store_id, enabled, mode, button_position, button_text, primary_color)
       VALUES ($1, false, 'floating', 'bottom-right', 'Try On', '#000000')
       ON CONFLICT (store_id) DO NOTHING
       RETURNING *`,
      [storeId]
    );

    return result.rows[0];
  }

  async updateVTOSettings(
    storeId: string,
    data: UpdateVTOSettingsRequest
  ): Promise<VTOSettings> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.enabled !== undefined) {
      fields.push(`enabled = $${paramCount}`);
      values.push(data.enabled);
      paramCount++;
    }

    if (data.mode !== undefined) {
      fields.push(`mode = $${paramCount}`);
      values.push(data.mode);
      paramCount++;
    }

    if (data.button_position !== undefined) {
      fields.push(`button_position = $${paramCount}`);
      values.push(data.button_position);
      paramCount++;
    }

    if (data.button_text !== undefined) {
      fields.push(`button_text = $${paramCount}`);
      values.push(data.button_text);
      paramCount++;
    }

    if (data.primary_color !== undefined) {
      fields.push(`primary_color = $${paramCount}`);
      values.push(data.primary_color);
      paramCount++;
    }

    if (fields.length === 0) {
      throw createError('No fields to update', 400);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(storeId);

    const query = `
      UPDATE vto_settings
      SET ${fields.join(', ')}
      WHERE store_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw createError('VTO settings not found', 404);
    }

    return result.rows[0];
  }

  // Body Scan Management

  async createBodyScan(data: {
    storeId: string;
    visitorId?: string;
    userId?: string;
    imageUrls: string[];
    status?: string;
  }): Promise<BodyScan> {
    const result = await pool.query(
      `INSERT INTO body_scans (store_id, visitor_id, user_id, image_urls, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.storeId,
        data.visitorId || null,
        data.userId || null,
        data.imageUrls,
        data.status || 'pending',
      ]
    );

    return result.rows[0];
  }

  async getBodyScan(scanId: string): Promise<BodyScan | null> {
    const result = await pool.query(
      `SELECT * FROM body_scans WHERE id = $1`,
      [scanId]
    );

    return result.rows[0] || null;
  }

  async getBodyScanWithMeasurements(scanId: string): Promise<{
    scan: BodyScan;
    measurements?: BodyMeasurements;
  } | null> {
    const result = await pool.query(
      `SELECT
        bs.*,
        bm.id as measurement_id,
        bm.height_cm, bm.weight_kg, bm.chest_cm, bm.waist_cm,
        bm.hips_cm, bm.inseam_cm, bm.shoulder_width_cm,
        bm.sleeve_length_cm, bm.neck_cm, bm.confidence_score,
        bm.measured_at
       FROM body_scans bs
       LEFT JOIN body_measurements bm ON bs.id = bm.body_scan_id
       WHERE bs.id = $1`,
      [scanId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const scan: BodyScan = {
      id: row.id,
      user_id: row.user_id,
      visitor_id: row.visitor_id,
      store_id: row.store_id,
      status: row.status,
      image_urls: row.image_urls,
      mesh_url: row.mesh_url,
      quality_score: row.quality_score,
      processing_time_ms: row.processing_time_ms,
      error_message: row.error_message,
      created_at: row.created_at,
      completed_at: row.completed_at,
    };

    let measurements: BodyMeasurements | undefined;
    if (row.measurement_id) {
      measurements = {
        id: row.measurement_id,
        body_scan_id: scanId,
        height_cm: row.height_cm,
        weight_kg: row.weight_kg,
        chest_cm: row.chest_cm,
        waist_cm: row.waist_cm,
        hips_cm: row.hips_cm,
        inseam_cm: row.inseam_cm,
        shoulder_width_cm: row.shoulder_width_cm,
        sleeve_length_cm: row.sleeve_length_cm,
        neck_cm: row.neck_cm,
        confidence_score: row.confidence_score,
        measured_at: row.measured_at,
      };
    }

    return { scan, measurements };
  }

  async updateBodyScan(
    scanId: string,
    data: {
      status?: string;
      meshUrl?: string;
      qualityScore?: number;
      processingTimeMs?: number;
      errorMessage?: string;
    }
  ): Promise<BodyScan> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.status !== undefined) {
      fields.push(`status = $${paramCount}`);
      values.push(data.status);
      paramCount++;
    }

    if (data.meshUrl !== undefined) {
      fields.push(`mesh_url = $${paramCount}`);
      values.push(data.meshUrl);
      paramCount++;
    }

    if (data.qualityScore !== undefined) {
      fields.push(`quality_score = $${paramCount}`);
      values.push(data.qualityScore);
      paramCount++;
    }

    if (data.processingTimeMs !== undefined) {
      fields.push(`processing_time_ms = $${paramCount}`);
      values.push(data.processingTimeMs);
      paramCount++;
    }

    if (data.errorMessage !== undefined) {
      fields.push(`error_message = $${paramCount}`);
      values.push(data.errorMessage);
      paramCount++;
    }

    if (data.status === 'completed' || data.status === 'failed') {
      fields.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    if (fields.length === 0) {
      throw createError('No fields to update', 400);
    }

    values.push(scanId);

    const query = `
      UPDATE body_scans
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw createError('Body scan not found', 404);
    }

    return result.rows[0];
  }

  // Body Measurements

  async createBodyMeasurements(data: {
    bodyScanId: string;
    height?: number;
    weight?: number;
    chest?: number;
    waist?: number;
    hips?: number;
    inseam?: number;
    shoulderWidth?: number;
    sleeveLength?: number;
    neck?: number;
    confidenceScore?: number;
  }): Promise<BodyMeasurements> {
    const result = await pool.query(
      `INSERT INTO body_measurements
       (body_scan_id, height_cm, weight_kg, chest_cm, waist_cm, hips_cm,
        inseam_cm, shoulder_width_cm, sleeve_length_cm, neck_cm, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        data.bodyScanId,
        data.height || null,
        data.weight || null,
        data.chest || null,
        data.waist || null,
        data.hips || null,
        data.inseam || null,
        data.shoulderWidth || null,
        data.sleeveLength || null,
        data.neck || null,
        data.confidenceScore || null,
      ]
    );

    return result.rows[0];
  }

  async getBodyMeasurements(bodyScanId: string): Promise<BodyMeasurements | null> {
    const result = await pool.query(
      `SELECT * FROM body_measurements WHERE body_scan_id = $1`,
      [bodyScanId]
    );

    return result.rows[0] || null;
  }

  // VTO Sessions

  async createTryOnSession(data: {
    storeId: string;
    bodyScanId?: string;
    productId?: string;
    variantId?: string;
    visitorId: string;
  }): Promise<VTOSession> {
    const result = await pool.query(
      `INSERT INTO vto_sessions (store_id, body_scan_id, product_id, variant_id, visitor_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.storeId, data.bodyScanId || null, data.productId || null, data.variantId || null, data.visitorId]
    );

    return result.rows[0];
  }

  async getVTOSession(sessionId: string): Promise<VTOSession | null> {
    const result = await pool.query(
      `SELECT * FROM vto_sessions WHERE id = $1`,
      [sessionId]
    );

    return result.rows[0] || null;
  }

  async updateVTOSession(
    sessionId: string,
    data: {
      durationSeconds?: number;
      garmentsTried?: number;
      screenshotTaken?: boolean;
      sharedSocial?: boolean;
      converted?: boolean;
      sessionData?: any;
    }
  ): Promise<VTOSession> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.durationSeconds !== undefined) {
      fields.push(`duration_seconds = $${paramCount}`);
      values.push(data.durationSeconds);
      paramCount++;
    }

    if (data.garmentsTried !== undefined) {
      fields.push(`garments_tried = $${paramCount}`);
      values.push(data.garmentsTried);
      paramCount++;
    }

    if (data.screenshotTaken !== undefined) {
      fields.push(`screenshot_taken = $${paramCount}`);
      values.push(data.screenshotTaken);
      paramCount++;
    }

    if (data.sharedSocial !== undefined) {
      fields.push(`shared_social = $${paramCount}`);
      values.push(data.sharedSocial);
      paramCount++;
    }

    if (data.converted !== undefined) {
      fields.push(`converted = $${paramCount}`);
      values.push(data.converted);
      paramCount++;
    }

    if (data.sessionData !== undefined) {
      fields.push(`session_data = $${paramCount}`);
      values.push(JSON.stringify(data.sessionData));
      paramCount++;
    }

    if (fields.length === 0) {
      throw createError('No fields to update', 400);
    }

    values.push(sessionId);

    const query = `
      UPDATE vto_sessions
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw createError('VTO session not found', 404);
    }

    return result.rows[0];
  }

  async endVTOSession(sessionId: string): Promise<VTOSession> {
    const result = await pool.query(
      `UPDATE vto_sessions
       SET ended_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      throw createError('VTO session not found', 404);
    }

    return result.rows[0];
  }

  // Size Recommendations

  async createSizeRecommendation(data: {
    bodyScanId?: string;
    productId: string;
    variantId?: string;
    recommendedSize: string;
    confidence: number;
    allSizes: Record<string, number>;
    fitAdvice?: string;
  }): Promise<SizeRecommendation> {
    const result = await pool.query(
      `INSERT INTO size_recommendations
       (body_scan_id, product_id, variant_id, recommended_size, confidence, all_sizes, fit_advice)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.bodyScanId || null,
        data.productId,
        data.variantId || null,
        data.recommendedSize,
        data.confidence,
        JSON.stringify(data.allSizes),
        data.fitAdvice || null,
      ]
    );

    return result.rows[0];
  }

  async getSizeRecommendation(bodyScanId: string, productId: string): Promise<SizeRecommendation | null> {
    const result = await pool.query(
      `SELECT * FROM size_recommendations
       WHERE body_scan_id = $1 AND product_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [bodyScanId, productId]
    );

    return result.rows[0] || null;
  }

  // Event Tracking

  async trackEvent(data: {
    eventType: string;
    storeId: string;
    visitorId?: string;
    sessionId?: string;
    productId?: string;
    variantId?: string;
    metadata?: any;
  }): Promise<VTOEvent> {
    const result = await pool.query(
      `INSERT INTO vto_events
       (event_type, store_id, visitor_id, session_id, product_id, variant_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.eventType,
        data.storeId,
        data.visitorId || null,
        data.sessionId || null,
        data.productId || null,
        data.variantId || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );

    return result.rows[0];
  }

  // Analytics

  async getVTOAnalytics(
    storeId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<VTOAnalyticsResponse> {
    const dateFilter = startDate && endDate
      ? `AND timestamp BETWEEN $2 AND $3`
      : '';
    const params = startDate && endDate ? [storeId, startDate, endDate] : [storeId];

    // Get total scans
    const scansResult = await pool.query(
      `SELECT COUNT(*) as total_scans FROM body_scans WHERE store_id = $1 ${dateFilter}`,
      params
    );

    // Get total sessions
    const sessionsResult = await pool.query(
      `SELECT COUNT(*) as total_sessions, AVG(duration_seconds) as avg_duration
       FROM vto_sessions WHERE store_id = $1 ${dateFilter}`,
      params
    );

    // Get conversion rate
    const conversionsResult = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE converted = true) as conversions,
        COUNT(*) as total_sessions
       FROM vto_sessions WHERE store_id = $1 ${dateFilter}`,
      params
    );

    const conversionRate =
      conversionsResult.rows[0].total_sessions > 0
        ? (conversionsResult.rows[0].conversions / conversionsResult.rows[0].total_sessions) * 100
        : 0;

    // Get top products
    const topProductsResult = await pool.query(
      `SELECT
        product_id,
        COUNT(*) as try_on_count,
        AVG(duration_seconds) as avg_session_duration,
        COUNT(*) FILTER (WHERE converted = true)::float / COUNT(*) * 100 as conversion_rate
       FROM vto_sessions
       WHERE store_id = $1 AND product_id IS NOT NULL ${dateFilter}
       GROUP BY product_id
       ORDER BY try_on_count DESC
       LIMIT 10`,
      params
    );

    // Get timeline data (last 30 days)
    const timelineResult = await pool.query(
      `SELECT
        DATE(timestamp) as date,
        COUNT(*) FILTER (WHERE event_type = 'body_scan_completed') as scans,
        COUNT(*) FILTER (WHERE event_type = 'try_on_started') as sessions,
        COUNT(*) FILTER (WHERE event_type = 'purchase_completed') as conversions
       FROM vto_events
       WHERE store_id = $1 ${dateFilter}
       GROUP BY DATE(timestamp)
       ORDER BY date DESC
       LIMIT 30`,
      params
    );

    return {
      total_scans: parseInt(scansResult.rows[0].total_scans),
      total_sessions: parseInt(sessionsResult.rows[0].total_sessions),
      avg_session_duration: parseFloat(sessionsResult.rows[0].avg_duration) || 0,
      conversion_rate: parseFloat(conversionRate.toFixed(2)),
      top_products: topProductsResult.rows.map(row => ({
        product_id: row.product_id,
        product_name: '', // Would need to join with products table
        try_on_count: parseInt(row.try_on_count),
        conversion_rate: parseFloat(row.conversion_rate || 0).toFixed(2) as any,
        avg_session_duration: parseFloat(row.avg_session_duration || 0),
      })),
      timeline: timelineResult.rows.map(row => ({
        date: row.date,
        scans: parseInt(row.scans),
        sessions: parseInt(row.sessions),
        conversions: parseInt(row.conversions),
      })),
      size_recommendations: {
        total_recommendations: 0, // Would need separate query
        most_recommended_sizes: {},
      },
    };
  }

  // S3 Helpers

  async uploadImagesToS3(images: Buffer[], storeId: string): Promise<string[]> {
    const urls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const key = `vto/${storeId}/${Date.now()}-${i}.jpg`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: images[i],
          ContentType: 'image/jpeg',
        })
      );

      urls.push(`https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`);
    }

    return urls;
  }

  async uploadMeshToS3(mesh: Buffer, scanId: string): Promise<string> {
    const key = `vto/meshes/${scanId}.glb`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: mesh,
        ContentType: 'model/gltf-binary',
      })
    );

    return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }
}

export default new VTOService();
