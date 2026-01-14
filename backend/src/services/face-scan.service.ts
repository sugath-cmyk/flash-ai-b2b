import { pool } from '../config/database';
import axios from 'axios';
import FormData from 'form-data';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://flash-ai-ml-inference.onrender.com';

/**
 * Face Scan Service
 * Handles face scanning, analysis, and product recommendations
 */

// Create face scan record
export async function createFaceScan(data: {
  storeId: string;
  visitorId: string;
  status: string;
}) {
  const result = await pool.query(
    `INSERT INTO face_scans (store_id, visitor_id, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.storeId, data.visitorId, data.status]
  );
  return result.rows[0];
}

// Get face scan by ID
export async function getFaceScan(scanId: string) {
  const result = await pool.query(
    `SELECT
       fs.id,
       fs.store_id,
       fs.visitor_id,
       fs.user_id,
       fs.status,
       fs.front_image_url,
       fs.left_profile_url,
       fs.right_profile_url,
       fs.quality_score,
       fs.processing_time_ms,
       fs.error_message,
       fs.created_at,
       fs.completed_at,
       fa.skin_score,
       fa.skin_tone,
       fa.skin_undertone,
       fa.skin_hex_color,
       fa.face_shape,
       fa.pigmentation_score,
       fa.acne_score,
       fa.wrinkle_score,
       fa.texture_score,
       fa.redness_score,
       fa.hydration_score,
       fa.hydration_level,
       fa.oiliness_score,
       fa.skin_age_estimate
     FROM face_scans fs
     LEFT JOIN face_analysis fa ON fs.id = fa.face_scan_id
     WHERE fs.id = $1`,
    [scanId]
  );
  return result.rows[0];
}

// Update face scan
export async function updateFaceScan(scanId: string, data: {
  status?: string;
  frontImageUrl?: string;
  leftProfileUrl?: string;
  rightProfileUrl?: string;
  qualityScore?: number;
  processingTime?: number;
  errorMessage?: string;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.status) {
    updates.push(`status = $${paramIndex}`);
    values.push(data.status);
    paramIndex++;
  }

  if (data.frontImageUrl) {
    updates.push(`front_image_url = $${paramIndex}`);
    values.push(data.frontImageUrl);
    paramIndex++;
  }

  if (data.leftProfileUrl) {
    updates.push(`left_profile_url = $${paramIndex}`);
    values.push(data.leftProfileUrl);
    paramIndex++;
  }

  if (data.rightProfileUrl) {
    updates.push(`right_profile_url = $${paramIndex}`);
    values.push(data.rightProfileUrl);
    paramIndex++;
  }

  if (data.qualityScore !== undefined) {
    updates.push(`quality_score = $${paramIndex}`);
    values.push(data.qualityScore);
    paramIndex++;
  }

  if (data.processingTime !== undefined) {
    updates.push(`processing_time_ms = $${paramIndex}`);
    values.push(data.processingTime);
    paramIndex++;
  }

  if (data.errorMessage) {
    updates.push(`error_message = $${paramIndex}`);
    values.push(data.errorMessage);
    paramIndex++;
  }

  if (data.status === 'completed') {
    updates.push(`completed_at = NOW()`);
  }

  values.push(scanId);

  const query = `
    UPDATE face_scans
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Save face analysis results
export async function saveFaceAnalysis(scanId: string, analysis: any) {
  // Build dynamic query based on available analysis fields
  const fields = Object.keys(analysis);
  const columns = ['face_scan_id', ...fields];
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const values = [scanId, ...fields.map(field => {
    // Convert JSONB fields to strings
    if (typeof analysis[field] === 'object' && analysis[field] !== null) {
      return JSON.stringify(analysis[field]);
    }
    return analysis[field];
  })];

  // Create update clause for ON CONFLICT
  const updateClauses = fields.map(field => `${field} = EXCLUDED.${field}`).join(', ');

  const query = `
    INSERT INTO face_analysis (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (face_scan_id)
    DO UPDATE SET ${updateClauses}, analyzed_at = NOW()
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Process face scan with ML service
export async function processFaceScan(scanId: string, files: Express.Multer.File[]) {
  const startTime = Date.now();

  try {
    // Prepare form data for ML service
    const formData = new FormData();
    formData.append('scan_id', scanId);

    for (const file of files) {
      formData.append('images', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    }

    // Call ML service for face analysis
    const response = await axios.post(`${ML_SERVICE_URL}/face-scan`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000 // 60 second timeout
    });

    const processingTime = Date.now() - startTime;

    // Update scan with results
    await updateFaceScan(scanId, {
      status: 'completed',
      qualityScore: response.data.quality_score,
      processingTime
    });

    // Save complete analysis results
    await saveFaceAnalysis(scanId, response.data.analysis);

  } catch (error: any) {
    console.error('Face scan processing error:', error);

    await updateFaceScan(scanId, {
      status: 'failed',
      errorMessage: error.message || 'Processing failed',
      processingTime: Date.now() - startTime
    });

    throw error;
  }
}

// Get product recommendations based on face analysis
export async function getProductRecommendations(scanId: string, storeId: string) {
  // Get face analysis
  const scan = await getFaceScan(scanId);

  if (!scan || scan.status !== 'completed') {
    throw new Error('Face scan not completed');
  }

  // Get store products
  const productsResult = await pool.query(
    `SELECT product_id, title, description, product_type, tags, price, image_url, variants
     FROM products
     WHERE store_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 100`,
    [storeId]
  );

  const products = productsResult.rows;

  // Match products based on face analysis
  const recommendations = matchProducts(scan, products);

  // Save recommendations to database
  for (let i = 0; i < recommendations.length; i++) {
    const rec = recommendations[i];
    await pool.query(
      `INSERT INTO face_scan_recommendations (
        face_scan_id, product_id, recommendation_type,
        confidence_score, reason, product_title,
        product_image_url, product_price, rank
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING`,
      [
        scanId,
        rec.productId,
        rec.type,
        rec.confidence,
        rec.reason,
        rec.title,
        rec.imageUrl,
        rec.price,
        i + 1
      ]
    );
  }

  return recommendations;
}

// Match products based on detailed skin analysis
function matchProducts(scan: any, products: any[]) {
  const recommendations: any[] = [];

  // Extract key skin concerns from analysis
  const concerns = extractSkinConcerns(scan);
  const skinTone = scan.skin_tone?.toLowerCase();
  const skinUndertone = scan.skin_undertone?.toLowerCase();
  const faceShape = scan.face_shape?.toLowerCase();
  const hydrationLevel = scan.hydration_level?.toLowerCase();

  for (const product of products) {
    const title = (product.title || '').toLowerCase();
    const description = (product.description || '').toLowerCase();
    const tags = (product.tags || '').toLowerCase();
    const productType = (product.product_type || '').toLowerCase();
    const combined = `${title} ${description} ${tags}`;

    let score = 0;
    let reasons: string[] = [];
    let type = 'general';
    let ingredientsMatch: string[] = [];

    // === TARGETED SKINCARE RECOMMENDATIONS ===

    // 1. PIGMENTATION CONCERNS (dark spots, melasma, sun damage)
    if (concerns.pigmentation && concerns.pigmentation.severity > 30) {
      if (productType.includes('serum') || productType.includes('treatment') || productType.includes('cream')) {
        // Look for brightening ingredients
        if (combined.includes('vitamin c') || combined.includes('niacinamide') ||
            combined.includes('kojic acid') || combined.includes('arbutin') ||
            combined.includes('bright') || combined.includes('spot') ||
            combined.includes('hyperpigmentation') || combined.includes('dark spot')) {
          score += 45;
          type = 'pigmentation_treatment';
          reasons.push(`Addresses your dark spots (${concerns.pigmentation.count} detected)`);
          if (combined.includes('vitamin c')) ingredientsMatch.push('Vitamin C');
          if (combined.includes('niacinamide')) ingredientsMatch.push('Niacinamide');
          if (combined.includes('kojic acid')) ingredientsMatch.push('Kojic Acid');
        }
      }
      // Sunscreen is critical for pigmentation
      if (combined.includes('spf') || combined.includes('sunscreen') || combined.includes('sun protection')) {
        score += 40;
        type = 'pigmentation_prevention';
        reasons.push('SPF protection prevents further sun damage');
      }
    }

    // 2. ACNE CONCERNS
    if (concerns.acne && concerns.acne.severity > 25) {
      if (productType.includes('treatment') || productType.includes('serum') ||
          productType.includes('cleanser') || productType.includes('toner')) {
        // Look for acne-fighting ingredients
        if (combined.includes('salicylic acid') || combined.includes('benzoyl peroxide') ||
            combined.includes('tea tree') || combined.includes('niacinamide') ||
            combined.includes('acne') || combined.includes('blemish') ||
            combined.includes('pimple') || combined.includes('anti-acne')) {
          score += 50;
          type = 'acne_treatment';
          reasons.push(`Helps clear ${concerns.acne.count} detected blemishes`);
          if (combined.includes('salicylic acid')) ingredientsMatch.push('Salicylic Acid');
          if (combined.includes('benzoyl peroxide')) ingredientsMatch.push('Benzoyl Peroxide');
          if (combined.includes('tea tree')) ingredientsMatch.push('Tea Tree Oil');
        }
      }
    }

    // 3. WRINKLES & AGING CONCERNS
    if (concerns.wrinkles && concerns.wrinkles.severity > 30) {
      if (productType.includes('serum') || productType.includes('cream') ||
          productType.includes('treatment') || productType.includes('anti-aging')) {
        // Look for anti-aging ingredients
        if (combined.includes('retinol') || combined.includes('peptide') ||
            combined.includes('hyaluronic acid') || combined.includes('collagen') ||
            combined.includes('anti-aging') || combined.includes('wrinkle') ||
            combined.includes('fine lines') || combined.includes('firming')) {
          score += 48;
          type = 'anti_aging';
          reasons.push(`Targets fine lines and wrinkles (${concerns.wrinkles.count} detected)`);
          if (combined.includes('retinol')) ingredientsMatch.push('Retinol');
          if (combined.includes('peptide')) ingredientsMatch.push('Peptides');
          if (combined.includes('hyaluronic acid')) ingredientsMatch.push('Hyaluronic Acid');
        }
      }
    }

    // 4. HYDRATION CONCERNS
    if (hydrationLevel === 'dry' || (concerns.hydration && concerns.hydration.score < 50)) {
      if (productType.includes('moisturizer') || productType.includes('cream') ||
          productType.includes('serum') || productType.includes('hydrating')) {
        // Look for hydrating ingredients
        if (combined.includes('hyaluronic acid') || combined.includes('glycerin') ||
            combined.includes('ceramide') || combined.includes('hydrating') ||
            combined.includes('moisture') || combined.includes('dry skin')) {
          score += 42;
          type = 'hydration';
          reasons.push('Deeply hydrates dry skin');
          if (combined.includes('hyaluronic acid')) ingredientsMatch.push('Hyaluronic Acid');
          if (combined.includes('ceramide')) ingredientsMatch.push('Ceramides');
        }
      }
    } else if (hydrationLevel === 'oily' || (scan.oiliness_score && scan.oiliness_score > 70)) {
      if (productType.includes('cleanser') || productType.includes('toner') ||
          productType.includes('gel') || productType.includes('mattifying')) {
        // Look for oil-control products
        if (combined.includes('oil-free') || combined.includes('mattifying') ||
            combined.includes('oil control') || combined.includes('sebum') ||
            combined.includes('oily skin')) {
          score += 40;
          type = 'oil_control';
          reasons.push('Controls excess oil production');
        }
      }
    }

    // 5. REDNESS & SENSITIVITY
    if (concerns.redness && concerns.redness.severity > 30) {
      if (productType.includes('serum') || productType.includes('cream') ||
          productType.includes('treatment')) {
        // Look for calming ingredients
        if (combined.includes('centella') || combined.includes('niacinamide') ||
            combined.includes('aloe') || combined.includes('green tea') ||
            combined.includes('soothing') || combined.includes('calming') ||
            combined.includes('redness') || combined.includes('sensitive')) {
          score += 43;
          type = 'redness_relief';
          reasons.push('Soothes redness and sensitivity');
          if (combined.includes('centella')) ingredientsMatch.push('Centella');
          if (combined.includes('niacinamide')) ingredientsMatch.push('Niacinamide');
        }
      }
    }

    // 6. TEXTURE & PORE CONCERNS
    if (concerns.texture && concerns.texture.score < 60) {
      if (productType.includes('exfoliant') || productType.includes('peel') ||
          productType.includes('toner') || productType.includes('serum')) {
        // Look for texture-improving ingredients
        if (combined.includes('aha') || combined.includes('bha') ||
            combined.includes('glycolic acid') || combined.includes('lactic acid') ||
            combined.includes('pore') || combined.includes('exfoliat') ||
            combined.includes('smooth') || combined.includes('refining')) {
          score += 41;
          type = 'texture_improvement';
          reasons.push('Refines pores and smooths skin texture');
          if (combined.includes('glycolic acid')) ingredientsMatch.push('Glycolic Acid');
          if (combined.includes('lactic acid')) ingredientsMatch.push('Lactic Acid');
        }
      }
    }

    // === MAKEUP RECOMMENDATIONS ===

    // Foundation/Base makeup - match skin tone
    if (title.includes('foundation') || title.includes('concealer') ||
        title.includes('powder') || title.includes('bb cream') || title.includes('cc cream')) {
      if (skinTone && (tags.includes(skinTone) || description.includes(skinTone) || title.includes(skinTone))) {
        score += 38;
        reasons.push(`Perfect match for ${skinTone} skin tone`);
        type = type === 'general' ? 'skin_tone_match' : type;
      }
      if (skinUndertone && (tags.includes(skinUndertone) || description.includes(skinUndertone))) {
        score += 15;
        reasons.push(`Matches your ${skinUndertone} undertone`);
      }
    }

    // Color cosmetics based on undertone
    if (title.includes('lipstick') || title.includes('blush') || title.includes('eyeshadow')) {
      if (skinUndertone === 'cool' && (combined.includes('pink') || combined.includes('berry') || combined.includes('mauve'))) {
        score += 25;
        reasons.push('Cool tones complement your undertone');
        type = type === 'general' ? 'complementary' : type;
      } else if (skinUndertone === 'warm' && (combined.includes('coral') || combined.includes('peach') || combined.includes('warm'))) {
        score += 25;
        reasons.push('Warm tones complement your undertone');
        type = type === 'general' ? 'complementary' : type;
      }
    }

    // Add ingredient information to reason
    if (ingredientsMatch.length > 0) {
      reasons.push(`Key ingredients: ${ingredientsMatch.join(', ')}`);
    }

    // Add to recommendations if score is above threshold
    if (score >= 20) {
      recommendations.push({
        productId: product.product_id,
        title: product.title,
        imageUrl: product.image_url,
        price: product.price,
        confidence: Math.min(score / 100, 0.98),
        type: type,
        reason: reasons.join('. '),
        ingredients: ingredientsMatch
      });
    }
  }

  // Sort by confidence score
  recommendations.sort((a, b) => b.confidence - a.confidence);

  // Return top 12 recommendations
  return recommendations.slice(0, 12);
}

// Extract primary skin concerns from analysis
function extractSkinConcerns(scan: any) {
  return {
    pigmentation: scan.pigmentation_score ? {
      severity: scan.pigmentation_score,
      count: scan.dark_spots_count || 0
    } : null,
    acne: scan.acne_score ? {
      severity: scan.acne_score,
      count: (scan.whitehead_count || 0) + (scan.blackhead_count || 0) + (scan.pimple_count || 0)
    } : null,
    wrinkles: scan.wrinkle_score ? {
      severity: scan.wrinkle_score,
      count: (scan.fine_lines_count || 0) + (scan.deep_wrinkles_count || 0)
    } : null,
    texture: scan.texture_score ? {
      score: scan.texture_score,
      poreSize: scan.pore_size_average
    } : null,
    redness: scan.redness_score ? {
      severity: scan.redness_score,
      sensitive: scan.sensitivity_level
    } : null,
    hydration: scan.hydration_score ? {
      score: scan.hydration_score,
      level: scan.hydration_level
    } : null
  };
}

// Track face scan event
export async function trackFaceScanEvent(data: {
  eventType: string;
  storeId: string;
  visitorId?: string;
  faceScanId?: string;
  sessionId?: string;
  productId?: string;
  metadata?: any;
}) {
  await pool.query(
    `INSERT INTO face_scan_events (
      event_type, store_id, visitor_id, face_scan_id,
      session_id, product_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      data.eventType,
      data.storeId,
      data.visitorId,
      data.faceScanId,
      data.sessionId,
      data.productId,
      JSON.stringify(data.metadata || {})
    ]
  );
}
