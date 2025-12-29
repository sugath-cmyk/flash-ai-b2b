import { pool } from '../config/database';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Product Intelligence Service
 * Uses AI to extract comprehensive product metadata for intelligent recommendations
 */

interface ProductAnalysisResult {
  ingredients: string[];
  keyBenefits: string[];
  skinTypes: string[];
  concerns: string[];
  usageInstructions: string;
  usageFrequency: string;
  usageTime: string[];
  resultsTimeline: string;
  texture: string;
  productCategory: string;
  productSubcategory: string;
  isVegan: boolean;
  isCrueltyFree: boolean;
  isPregnancySafe: boolean | null;
  isFragranceFree: boolean;
  isNatural: boolean;
  allergens: string[];
  shortDescription: string;
  confidence: number;
}

export class ProductIntelligenceService {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Analyze a single product and extract intelligence
   */
  async analyzeProduct(productId: string): Promise<ProductAnalysisResult> {
    if (!this.anthropic) {
      throw new Error('AI service not configured');
    }

    // Get product details
    const productResult = await pool.query(
      `SELECT id, title, description, tags, vendor, product_type, price, raw_data
       FROM extracted_products WHERE id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }

    const product = productResult.rows[0];

    // Build analysis prompt
    const analysisPrompt = `Analyze this skincare/beauty product and extract structured information.

Product Title: ${product.title}
Vendor/Brand: ${product.vendor}
Product Type: ${product.product_type}
Price: ₹${product.price}
Tags: ${product.tags?.join(', ') || 'none'}

Product Description:
${this.stripHtml(product.description || '')}

TASK: Extract the following information in JSON format:

{
  "ingredients": ["ingredient1", "ingredient2"], // List ALL ingredients mentioned
  "keyBenefits": ["benefit1", "benefit2"], // 3-5 key benefits
  "skinTypes": [], // Array from: ["oily", "dry", "combination", "sensitive", "normal", "mature", "all"]
  "concerns": [], // Array from: ["acne", "dark_spots", "aging", "hydration", "brightening", "oil_control", "redness", "pores", "texture", "dullness", "fine_lines", "wrinkles", "hyperpigmentation"]
  "usageInstructions": "Step by step how to use",
  "usageFrequency": "daily" | "twice_daily" | "weekly" | "as_needed",
  "usageTime": ["am", "pm"] or ["am"] or ["pm"],
  "resultsTimeline": "e.g., 2-4 weeks for visible results",
  "texture": "gel" | "cream" | "serum" | "oil" | "lotion" | "foam" | "powder" | "balm",
  "productCategory": "cleanser" | "toner" | "serum" | "moisturizer" | "treatment" | "sunscreen" | "mask" | "exfoliant" | "eye_cream" | "lip_care" | "body_care",
  "productSubcategory": "more specific category",
  "isVegan": true/false (if explicitly stated or no animal ingredients),
  "isCrueltyFree": true/false (if explicitly stated),
  "isPregnancySafe": true/false/null (null if unknown, false if contains retinol/salicylic acid/hydroquinone),
  "isFragranceFree": true/false,
  "isNatural": true/false (if marketed as natural/organic),
  "allergens": ["fragrance", "essential oils", "nuts", "soy"], // Common allergens present
  "shortDescription": "1-2 sentence summary focusing on key ingredients and benefits",
  "confidence": 0.0-1.0 // How confident you are in this analysis
}

IMPORTANT RULES:
1. Only extract information explicitly stated or strongly implied
2. For boolean fields, only set true if explicitly mentioned or clearly indicated
3. Use null for pregnancy safety if uncertain
4. Include confidence score based on available information
5. Identify ALL ingredients mentioned in description
6. Be conservative with claims - don't infer too much
7. If multiple skin types can use it, list all applicable ones
8. Return ONLY valid JSON, no explanatory text`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent structured output
        messages: [
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';

      // Parse JSON response
      const analysis = JSON.parse(content) as ProductAnalysisResult;

      // Save analysis results
      await this.saveProductIntelligence(productId, analysis);

      // Track AI analysis
      await pool.query(
        `INSERT INTO product_ai_analysis
         (product_id, analysis_type, model_used, input_data, output_data, confidence_score, status, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          productId,
          'comprehensive_analysis',
          'claude-3-5-sonnet-20241022',
          JSON.stringify({ title: product.title, description: product.description }),
          JSON.stringify(analysis),
          analysis.confidence,
          'completed',
        ]
      );

      return analysis;
    } catch (error: any) {
      // Track failed analysis
      await pool.query(
        `INSERT INTO product_ai_analysis
         (product_id, analysis_type, model_used, status, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [productId, 'comprehensive_analysis', 'claude-3-5-sonnet-20241022', 'failed', error.message]
      );

      throw error;
    }
  }

  /**
   * Save extracted intelligence to database
   */
  private async saveProductIntelligence(productId: string, analysis: ProductAnalysisResult): Promise<void> {
    await pool.query(
      `UPDATE extracted_products
       SET
         ingredients = $1,
         key_benefits = $2,
         skin_types = $3,
         concerns = $4,
         usage_instructions = $5,
         usage_frequency = $6,
         usage_time = $7,
         results_timeline = $8,
         texture = $9,
         product_category = $10,
         product_subcategory = $11,
         is_vegan = $12,
         is_cruelty_free = $13,
         is_pregnancy_safe = $14,
         is_fragrance_free = $15,
         is_natural = $16,
         allergens = $17,
         short_description = $18,
         ai_metadata = $19,
         updated_at = NOW()
       WHERE id = $20`,
      [
        analysis.ingredients,
        analysis.keyBenefits,
        analysis.skinTypes,
        analysis.concerns,
        analysis.usageInstructions,
        analysis.usageFrequency,
        analysis.usageTime,
        analysis.resultsTimeline,
        analysis.texture,
        analysis.productCategory,
        analysis.productSubcategory,
        analysis.isVegan,
        analysis.isCrueltyFree,
        analysis.isPregnancySafe,
        analysis.isFragranceFree,
        analysis.isNatural,
        analysis.allergens,
        analysis.shortDescription,
        JSON.stringify({ confidence: analysis.confidence, analyzed_at: new Date().toISOString() }),
        productId,
      ]
    );
  }

  /**
   * Batch analyze all products for a store
   */
  async analyzeStoreProducts(storeId: string, limit?: number): Promise<void> {
    const query = limit
      ? `SELECT id FROM extracted_products
         WHERE store_id = $1 AND ingredients IS NULL
         ORDER BY created_at DESC LIMIT $2`
      : `SELECT id FROM extracted_products
         WHERE store_id = $1 AND ingredients IS NULL
         ORDER BY created_at DESC`;

    const params = limit ? [storeId, limit] : [storeId];
    const result = await pool.query(query, params);

    console.log(`Found ${result.rows.length} products to analyze for store ${storeId}`);

    let analyzed = 0;
    let failed = 0;

    for (const row of result.rows) {
      try {
        console.log(`Analyzing product ${row.id}...`);
        await this.analyzeProduct(row.id);
        analyzed++;
        console.log(`✅ Analyzed ${analyzed}/${result.rows.length}`);

        // Rate limiting - pause between requests
        await this.sleep(1000); // 1 second between requests
      } catch (error: any) {
        failed++;
        console.error(`❌ Failed to analyze product ${row.id}:`, error.message);
      }
    }

    console.log(`\n✅ Analysis complete: ${analyzed} analyzed, ${failed} failed`);
  }

  /**
   * Find similar products based on ingredients and benefits
   */
  async findSimilarProducts(productId: string, limit: number = 5): Promise<any[]> {
    const result = await pool.query(
      `WITH target_product AS (
         SELECT ingredients, concerns, skin_types, product_category, price
         FROM extracted_products WHERE id = $1
       )
       SELECT
         p.id,
         p.title,
         p.price,
         p.short_description,
         p.ingredients,
         p.key_benefits,
         -- Calculate similarity score
         (
           -- Ingredient overlap (40%)
           (SELECT COUNT(*) * 40 FROM unnest(p.ingredients) WHERE unnest = ANY((SELECT ingredients FROM target_product)))::NUMERIC / GREATEST(array_length(p.ingredients, 1), 1)
           +
           -- Concern overlap (30%)
           (SELECT COUNT(*) * 30 FROM unnest(p.concerns) WHERE unnest = ANY((SELECT concerns FROM target_product)))::NUMERIC / GREATEST(array_length(p.concerns, 1), 1)
           +
           -- Skin type overlap (20%)
           (SELECT COUNT(*) * 20 FROM unnest(p.skin_types) WHERE unnest = ANY((SELECT skin_types FROM target_product)))::NUMERIC / GREATEST(array_length(p.skin_types, 1), 1)
           +
           -- Same category (10%)
           CASE WHEN p.product_category = (SELECT product_category FROM target_product) THEN 10 ELSE 0 END
         ) AS similarity_score,
         ABS(p.price::NUMERIC - (SELECT price::NUMERIC FROM target_product)) AS price_difference
       FROM extracted_products p, target_product
       WHERE p.id != $1
         AND p.ingredients IS NOT NULL
         AND p.store_id = (SELECT store_id FROM extracted_products WHERE id = $1)
       ORDER BY similarity_score DESC, price_difference ASC
       LIMIT $2`,
      [productId, limit]
    );

    return result.rows;
  }

  /**
   * Find products by customer profile
   */
  async findProductsByProfile(
    storeId: string,
    profile: {
      skinType?: string;
      concerns?: string[];
      preferences?: {
        vegan?: boolean;
        crueltyFree?: boolean;
        fragranceFree?: boolean;
        priceMax?: number;
      };
      category?: string;
    },
    limit: number = 10
  ): Promise<any[]> {
    let whereConditions: string[] = ['p.store_id = $1', 'p.ingredients IS NOT NULL'];
    let queryParams: any[] = [storeId];
    let paramIndex = 2;

    // Skin type filter
    if (profile.skinType) {
      whereConditions.push(`($${paramIndex} = ANY(p.skin_types) OR 'all' = ANY(p.skin_types))`);
      queryParams.push(profile.skinType);
      paramIndex++;
    }

    // Category filter
    if (profile.category) {
      whereConditions.push(`p.product_category = $${paramIndex}`);
      queryParams.push(profile.category);
      paramIndex++;
    }

    // Preference filters
    if (profile.preferences?.vegan) {
      whereConditions.push('p.is_vegan = true');
    }

    if (profile.preferences?.crueltyFree) {
      whereConditions.push('p.is_cruelty_free = true');
    }

    if (profile.preferences?.fragranceFree) {
      whereConditions.push('p.is_fragrance_free = true');
    }

    if (profile.preferences?.priceMax) {
      whereConditions.push(`p.price::NUMERIC <= $${paramIndex}`);
      queryParams.push(profile.preferences.priceMax);
      paramIndex++;
    }

    // Build concern matching score
    let concernMatchScore = '0';
    if (profile.concerns && profile.concerns.length > 0) {
      concernMatchScore = `(
        SELECT COUNT(*) * 10
        FROM unnest($${paramIndex}::text[]) AS concern
        WHERE concern = ANY(p.concerns)
      )`;
      queryParams.push(profile.concerns);
      paramIndex++;
    }

    queryParams.push(limit);

    const query = `
      SELECT
        p.id,
        p.title,
        p.price,
        p.short_description,
        p.ingredients,
        p.key_benefits,
        p.skin_types,
        p.concerns,
        p.product_category,
        p.is_vegan,
        p.is_cruelty_free,
        p.is_pregnancy_safe,
        ${concernMatchScore} AS match_score
      FROM extracted_products p
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY match_score DESC, p.created_at DESC
      LIMIT $${paramIndex}
    `;

    const result = await pool.query(query, queryParams);
    return result.rows;
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new ProductIntelligenceService();
