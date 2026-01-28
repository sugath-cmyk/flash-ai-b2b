import { pool } from '../config/database';
import axios from 'axios';
import {
  getPersonalizedRecommendations,
  SkinProfile,
  FACTOR_COUNT
} from './recommendation-engine';
import FormData from 'form-data';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://flash-ai-ml-inference.onrender.com';

/**
 * Face Scan Service
 * Handles face scanning, analysis, and product recommendations
 */

// Use existing store for demo/test - this store has working face scans
const DEMO_FALLBACK_STORE_UUID = '62130715-ff42-4160-934e-c663fc1e7872';

// Create face scan record
export async function createFaceScan(data: {
  storeId: string;
  visitorId: string;
  status: string;
}) {
  // For demo stores, use the existing fallback store
  const isDemoStore = data.storeId === 'demo-store' || data.storeId === 'demo' || data.storeId === 'test';
  const storeIdValue = isDemoStore ? DEMO_FALLBACK_STORE_UUID : data.storeId;

  const result = await pool.query(
    `INSERT INTO face_scans (store_id, visitor_id, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [storeIdValue, data.visitorId, data.status]
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
       fa.skin_age_estimate,
       fa.dark_spots_count,
       fa.whitehead_count,
       fa.blackhead_count,
       fa.pimple_count,
       fa.fine_lines_count,
       fa.deep_wrinkles_count,
       fa.pore_size_average,
       fa.enlarged_pores_count,
       fa.smoothness_score,
       fa.roughness_level,
       fa.t_zone_oiliness,
       fa.sensitivity_level,
       fa.under_eye_darkness,
       fa.puffiness_score,
       fa.analysis_confidence
     FROM face_scans fs
     LEFT JOIN face_analysis fa ON fs.id = fa.face_scan_id
     WHERE fs.id = $1`,
    [scanId]
  );

  const row = result.rows[0];
  if (!row) return null;

  // Restructure to nest analysis fields under 'analysis' key
  // This matches the widget's expected format: scan.analysis.skin_score
  return {
    id: row.id,
    store_id: row.store_id,
    visitor_id: row.visitor_id,
    user_id: row.user_id,
    status: row.status,
    front_image_url: row.front_image_url,
    left_profile_url: row.left_profile_url,
    right_profile_url: row.right_profile_url,
    quality_score: row.quality_score,
    processing_time_ms: row.processing_time_ms,
    error_message: row.error_message,
    created_at: row.created_at,
    completed_at: row.completed_at,
    // Nest all analysis fields under 'analysis'
    analysis: row.skin_score !== null ? {
      skin_score: row.skin_score,
      skin_tone: row.skin_tone,
      skin_undertone: row.skin_undertone,
      skin_hex_color: row.skin_hex_color,
      face_shape: row.face_shape,
      pigmentation_score: row.pigmentation_score,
      acne_score: row.acne_score,
      wrinkle_score: row.wrinkle_score,
      texture_score: row.texture_score,
      redness_score: row.redness_score,
      hydration_score: row.hydration_score,
      hydration_level: row.hydration_level,
      oiliness_score: row.oiliness_score,
      skin_age_estimate: row.skin_age_estimate,
      dark_spots_count: row.dark_spots_count,
      whitehead_count: row.whitehead_count,
      blackhead_count: row.blackhead_count,
      pimple_count: row.pimple_count,
      fine_lines_count: row.fine_lines_count,
      deep_wrinkles_count: row.deep_wrinkles_count,
      pore_size_average: row.pore_size_average,
      enlarged_pores_count: row.enlarged_pores_count || 0,
      smoothness_score: row.smoothness_score,
      roughness_level: row.roughness_level,
      t_zone_oiliness: row.t_zone_oiliness,
      sensitivity_level: row.sensitivity_level,
      under_eye_darkness: row.under_eye_darkness,
      // Map to widget expected field - use 35 (moderate) as default if null/0/missing
      dark_circles_score: (row.under_eye_darkness != null && row.under_eye_darkness > 0)
        ? row.under_eye_darkness
        : 35,
      puffiness_score: row.puffiness_score,
      analysis_confidence: row.analysis_confidence
    } : null
  };
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
  // CALIBRATION: Dark circles - default to moderate, show actual only if severe
  // Most people have some level of dark circles - show moderate by default
  const originalDarkCircles = analysis.under_eye_darkness;
  let calibratedDarkCircles: number;

  if (originalDarkCircles !== undefined && originalDarkCircles !== null) {
    if (originalDarkCircles >= 60) {
      // SEVERE: Show actual score (these are real dark circles)
      calibratedDarkCircles = originalDarkCircles;
    } else if (originalDarkCircles >= 40) {
      // MEDIUM-HIGH: Show as moderate-medium (45-55 range)
      calibratedDarkCircles = Math.round(40 + (originalDarkCircles - 40) * 0.75);
    } else {
      // LOW/NOT DETECTED: Default to moderate (30-40 range)
      // Everyone has some level of under-eye darkness
      calibratedDarkCircles = Math.round(30 + (originalDarkCircles / 40) * 10);
    }
  } else {
    // ML service didn't detect/return dark circles - default to moderate (35)
    calibratedDarkCircles = 35;
  }

  analysis.under_eye_darkness = calibratedDarkCircles;
  console.log(`[FaceScan] Dark circles: ${originalDarkCircles ?? 'not detected'} → ${calibratedDarkCircles}`);

  // Define allowed database columns to prevent errors from new ML fields
  const ALLOWED_COLUMNS = new Set([
    'skin_score', 'skin_tone', 'skin_undertone', 'skin_hex_color',
    'face_shape', 'eye_color', 'hair_color',
    'face_width_cm', 'face_length_cm', 'eye_spacing_cm',
    'pigmentation_score', 'dark_spots_count', 'dark_spots_severity',
    'sun_damage_score', 'melasma_detected', 'hyperpigmentation_areas',
    'acne_score', 'whitehead_count', 'blackhead_count', 'pimple_count',
    'inflammation_level', 'acne_locations',
    'wrinkle_score', 'fine_lines_count', 'deep_wrinkles_count',
    'forehead_lines_severity', 'crows_feet_severity', 'nasolabial_folds_severity',
    'wrinkle_areas',
    'texture_score', 'pore_size_average', 'enlarged_pores_count',
    'roughness_level', 'smoothness_score', 'texture_map',
    'redness_score', 'sensitivity_level', 'irritation_detected',
    'rosacea_indicators', 'redness_areas',
    'hydration_score', 'hydration_level', 'oiliness_score',
    't_zone_oiliness', 'dry_patches_detected', 'hydration_map',
    'skin_age_estimate', 'skin_firmness_score',
    'under_eye_darkness', 'puffiness_score',
    'skin_tone_confidence', 'face_shape_confidence', 'analysis_confidence',
    'problem_areas_overlay', 'heatmap_data', 'metadata'
  ]);

  // Filter to only include allowed database columns
  const fields = Object.keys(analysis).filter(field => ALLOWED_COLUMNS.has(field));

  // Handle empty analysis - nothing to save
  if (fields.length === 0) {
    console.warn('saveFaceAnalysis called with empty or no valid analysis fields, skipping');
    return null;
  }

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

    // Check if ML service returned an error
    if (!response.data.success) {
      const errorMsg = response.data.error || 'Face analysis failed';
      console.error('ML service returned error:', errorMsg);
      await updateFaceScan(scanId, {
        status: 'failed',
        errorMessage: errorMsg,
        processingTime
      });
      return; // Don't throw - just mark as failed
    }

    // Update scan with results
    await updateFaceScan(scanId, {
      status: 'completed',
      qualityScore: response.data.quality_score,
      processingTime
    });

    // Save complete analysis results (only if we have analysis data)
    if (response.data.analysis && Object.keys(response.data.analysis).length > 0) {
      await saveFaceAnalysis(scanId, response.data.analysis);
    }

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
  try {
    // Get face analysis
    const scan = await getFaceScan(scanId);

    if (!scan || scan.status !== 'completed' || !scan.analysis) {
      console.log('Face scan not completed or no analysis, returning empty recommendations');
      return [];
    }

    // Get store products from extracted_products table
    const productsResult = await pool.query(
      `SELECT external_id as product_id, title, description, product_type, tags, price,
              images->0->>'src' as image_url, variants
       FROM extracted_products
       WHERE store_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [storeId]
    );

    const products = productsResult.rows;
    console.log(`Found ${products.length} products for store ${storeId}`);

    if (products.length === 0) {
      console.log('No products found, returning empty recommendations');
      return [];
    }

    // Build skin profile from analysis for the recommendation engine
    const skinProfile: SkinProfile = {
      skinType: determineSkinType(scan.analysis),
      concerns: extractConcernsList(scan.analysis),
      skinTone: scan.analysis.skin_tone || 'medium',
      skinUndertone: scan.analysis.skin_undertone || 'neutral',
      age: scan.analysis.skin_age_estimate || 30,
      sensitivity: scan.analysis.sensitivity_level || 30,
      hydrationLevel: scan.analysis.hydration_level || 'normal',
      oilinessScore: scan.analysis.oiliness_score || 50,
      pigmentationScore: scan.analysis.pigmentation_score || 0,
      acneScore: scan.analysis.acne_score || 0,
      wrinkleScore: scan.analysis.wrinkle_score || 0,
      textureScore: scan.analysis.texture_score || 70,
      rednessScore: scan.analysis.redness_score || 0
    };

    console.log(`Using recommendation engine with ${FACTOR_COUNT.total}+ factors`);

    // Get personalized recommendations using the advanced engine
    const engineRecommendations = getPersonalizedRecommendations(products, skinProfile, [], 12);

    // Transform to match expected format
    const recommendations = engineRecommendations.map(rec => ({
      productId: rec.productId,
      title: rec.title,
      imageUrl: rec.imageUrl,
      price: rec.price,
      confidence: rec.confidence,
      type: rec.type,
      reason: rec.reason,
      ingredients: rec.matchedIngredients,
      ingredientBenefits: rec.benefits,
      concernsAddressed: rec.concernsAddressed
    }));

    console.log(`Generated ${recommendations.length} personalized recommendations`);

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
  } catch (error: any) {
    console.error('Error getting recommendations:', error.message);
    // Return empty array instead of crashing
    return [];
  }
}

// Helper function to determine skin type from analysis
function determineSkinType(analysis: any): string {
  const oiliness = analysis.oiliness_score || 50;
  const hydration = analysis.hydration_score || 50;
  const hydrationLevel = (analysis.hydration_level || '').toLowerCase();

  if (oiliness > 70) return 'oily';
  if (oiliness > 55 && hydration < 60) return 'combination';
  if (hydrationLevel === 'dry' || hydration < 40) return 'dry';
  if (analysis.sensitivity_level > 60 || analysis.redness_score > 50) return 'sensitive';
  return 'normal';
}

// Helper function to extract concerns list from analysis scores
function extractConcernsList(analysis: any): string[] {
  const concerns: string[] = [];

  // Pigmentation concerns
  if (analysis.pigmentation_score > 30) {
    concerns.push('pigmentation');
    if (analysis.dark_spots_count > 5) concerns.push('dark_spots');
  }

  // Acne concerns
  if (analysis.acne_score > 25) {
    concerns.push('acne');
    if ((analysis.whitehead_count || 0) + (analysis.blackhead_count || 0) > 5) {
      concerns.push('blackheads');
    }
    if (analysis.pimple_count > 3) concerns.push('inflammatory_acne');
  }

  // Aging concerns
  if (analysis.wrinkle_score > 30) {
    concerns.push('aging');
    if (analysis.fine_lines_count > 10) concerns.push('fine_lines');
    if (analysis.deep_wrinkles_count > 3) concerns.push('deep_wrinkles');
  }

  // Texture concerns
  if (analysis.texture_score < 60) {
    concerns.push('texture');
    if (analysis.pore_size_average > 0.5) concerns.push('enlarged_pores');
  }

  // Redness concerns
  if (analysis.redness_score > 30) {
    concerns.push('redness');
    if (analysis.redness_score > 50) concerns.push('sensitivity');
  }

  // Hydration concerns
  const hydrationLevel = (analysis.hydration_level || '').toLowerCase();
  if (hydrationLevel === 'dry' || analysis.hydration_score < 40) {
    concerns.push('dryness');
  } else if (hydrationLevel === 'oily' || analysis.oiliness_score > 70) {
    concerns.push('oiliness');
  }

  // Dullness
  if (analysis.skin_score < 50) {
    concerns.push('dullness');
  }

  return concerns.length > 0 ? concerns : ['general'];
}

// Legacy ingredient database (kept for backward compatibility)
const INGREDIENT_BENEFITS: Record<string, { keywords: string[], benefit: string, concerns: string[] }> = {
  'vitamin_c': { keywords: ['vitamin c', 'ascorbic acid', 'l-ascorbic'], benefit: 'Brightens skin & fades dark spots', concerns: ['pigmentation', 'dullness'] },
  'niacinamide': { keywords: ['niacinamide', 'vitamin b3'], benefit: 'Minimizes pores & evens tone', concerns: ['pores', 'pigmentation', 'redness'] },
  'retinol': { keywords: ['retinol', 'retinoid', 'vitamin a'], benefit: 'Reduces wrinkles & boosts cell turnover', concerns: ['aging', 'wrinkles', 'texture'] },
  'hyaluronic_acid': { keywords: ['hyaluronic acid', 'sodium hyaluronate'], benefit: 'Intense hydration & plumping', concerns: ['dehydration', 'dryness', 'aging'] },
  'salicylic_acid': { keywords: ['salicylic acid', 'bha', 'beta hydroxy'], benefit: 'Unclogs pores & fights acne', concerns: ['acne', 'blackheads', 'oily'] },
  'glycolic_acid': { keywords: ['glycolic acid', 'aha', 'alpha hydroxy'], benefit: 'Exfoliates & brightens', concerns: ['texture', 'dullness', 'aging'] },
  'centella': { keywords: ['centella', 'cica', 'tiger grass', 'madecassoside'], benefit: 'Soothes & repairs skin barrier', concerns: ['redness', 'sensitivity', 'acne'] },
  'ceramide': { keywords: ['ceramide', 'ceramides'], benefit: 'Restores skin barrier', concerns: ['dryness', 'sensitivity', 'aging'] },
  'peptides': { keywords: ['peptide', 'peptides', 'matrixyl'], benefit: 'Boosts collagen & firms skin', concerns: ['aging', 'wrinkles', 'elasticity'] },
  'tea_tree': { keywords: ['tea tree', 'melaleuca'], benefit: 'Antibacterial & anti-inflammatory', concerns: ['acne', 'blemishes'] },
  'azelaic_acid': { keywords: ['azelaic acid'], benefit: 'Fights acne & fades marks', concerns: ['acne', 'pigmentation', 'redness'] },
  'arbutin': { keywords: ['arbutin', 'alpha arbutin'], benefit: 'Brightens & fades dark spots', concerns: ['pigmentation', 'dark spots'] },
  'bakuchiol': { keywords: ['bakuchiol'], benefit: 'Natural retinol alternative', concerns: ['aging', 'wrinkles', 'sensitivity'] },
  'tranexamic_acid': { keywords: ['tranexamic acid'], benefit: 'Targets stubborn pigmentation', concerns: ['pigmentation', 'melasma'] },
  'zinc': { keywords: ['zinc', 'zinc oxide'], benefit: 'Protects & controls oil', concerns: ['acne', 'oily', 'sun damage'] },
  'squalane': { keywords: ['squalane', 'squalene'], benefit: 'Lightweight moisture & softening', concerns: ['dryness', 'texture'] },
  'aloe': { keywords: ['aloe', 'aloe vera'], benefit: 'Calms & hydrates', concerns: ['redness', 'sensitivity', 'dryness'] }
};

// Match products based on detailed skin analysis
function matchProducts(scan: any, products: any[]) {
  const recommendations: any[] = [];

  // Extract key skin concerns from analysis
  const concerns = extractSkinConcerns(scan);
  const skinTone = scan.skin_tone?.toLowerCase();
  const skinUndertone = scan.skin_undertone?.toLowerCase();
  const faceShape = scan.face_shape?.toLowerCase();
  const hydrationLevel = scan.hydration_level?.toLowerCase();

  // Determine primary concerns for this user
  const userConcerns: string[] = [];
  if (concerns.pigmentation && concerns.pigmentation.severity > 30) userConcerns.push('pigmentation');
  if (concerns.acne && concerns.acne.severity > 25) userConcerns.push('acne');
  if (concerns.wrinkles && concerns.wrinkles.severity > 30) userConcerns.push('aging', 'wrinkles');
  if (concerns.texture && concerns.texture.score < 60) userConcerns.push('texture', 'pores');
  if (concerns.redness && concerns.redness.severity > 30) userConcerns.push('redness', 'sensitivity');
  if (hydrationLevel === 'dry') userConcerns.push('dryness', 'dehydration');
  if (hydrationLevel === 'oily' || (scan.oiliness_score && scan.oiliness_score > 70)) userConcerns.push('oily');

  for (const product of products) {
    const title = (product.title || '').toLowerCase();
    const description = (product.description || '').toLowerCase();
    // tags is an array (TEXT[]), join it into a string
    const tags = Array.isArray(product.tags) ? product.tags.join(' ').toLowerCase() : '';
    const productType = (product.product_type || '').toLowerCase();
    const combined = `${title} ${description} ${tags}`;

    let score = 0;
    let reasons: string[] = [];
    let type = 'general';
    let ingredientsMatch: string[] = [];
    let ingredientBenefits: string[] = [];

    // Check for beneficial ingredients based on user's concerns
    for (const [ingredientKey, data] of Object.entries(INGREDIENT_BENEFITS)) {
      const hasIngredient = data.keywords.some(kw => combined.includes(kw));
      if (hasIngredient) {
        const relevantToConcern = data.concerns.some(c => userConcerns.includes(c));
        if (relevantToConcern) {
          score += 12; // Bonus for matching concern-relevant ingredient
          ingredientsMatch.push(data.keywords[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
          ingredientBenefits.push(data.benefit);
        }
      }
    }

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

    // Add ingredient information to reason with benefits
    if (ingredientsMatch.length > 0) {
      // Remove duplicates
      const uniqueIngredients = [...new Set(ingredientsMatch)];
      const uniqueBenefits = [...new Set(ingredientBenefits)];
      reasons.push(`Key ingredients: ${uniqueIngredients.slice(0, 3).join(', ')}`);
      if (uniqueBenefits.length > 0) {
        reasons.push(`Benefits: ${uniqueBenefits.slice(0, 2).join('; ')}`);
      }
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
        ingredients: [...new Set(ingredientsMatch)],
        ingredientBenefits: [...new Set(ingredientBenefits)]
      });
    }
  }

  // Sort by confidence score
  recommendations.sort((a, b) => b.confidence - a.confidence);

  // Return top 12 recommendations, ensuring variety in types
  const result: any[] = [];
  const typesSeen = new Set<string>();

  // First pass: get one of each type
  for (const rec of recommendations) {
    if (!typesSeen.has(rec.type) && result.length < 12) {
      result.push(rec);
      typesSeen.add(rec.type);
    }
  }

  // Second pass: fill remaining slots with highest confidence
  for (const rec of recommendations) {
    if (!result.includes(rec) && result.length < 12) {
      result.push(rec);
    }
  }

  return result;
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
