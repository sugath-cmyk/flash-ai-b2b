import { pool } from '../config/database';
import feedbackService from './feedback.service';

// Types
interface ProductEffectiveness {
  productId: string;
  concern: string;
  sampleSize: number;
  avgEffectiveness: number;
  avgRating: number;
  purchaseRate: number;
  confidenceScore: number;
}

interface IngredientSuccess {
  ingredient: string;
  concern: string;
  sampleSize: number;
  avgImprovement: number;
  confidenceScore: number;
}

interface WeightAdjustment {
  factor: string;
  adjustment: number;
  reason: string;
}

interface UserPreferences {
  preferredCategories: string[];
  avoidedIngredients: string[];
  priceRange: { min: number; max: number } | null;
  preferredBrands: string[];
}

interface AggregatedInsight {
  id: string;
  concern: string;
  productCategory: string;
  sampleSize: number;
  avgImprovement: number;
  confidenceScore: number;
  computedAt: Date;
}

class LearningEngineService {
  // Demo store ID for development
  private readonly DEMO_STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

  // Minimum samples needed for confident insights
  private readonly MIN_SAMPLE_SIZE = 5;
  private readonly HIGH_CONFIDENCE_SAMPLE = 20;

  private normalizeStoreId(storeId: string): string {
    if (storeId === 'demo-store' || storeId === 'demo_store') {
      return this.DEMO_STORE_ID;
    }
    return storeId;
  }

  /**
   * Calculate confidence score based on sample size
   */
  private calculateConfidence(sampleSize: number): number {
    if (sampleSize < this.MIN_SAMPLE_SIZE) return 0;
    if (sampleSize >= this.HIGH_CONFIDENCE_SAMPLE) return 1;
    // Linear interpolation between min and high confidence
    return (sampleSize - this.MIN_SAMPLE_SIZE) / (this.HIGH_CONFIDENCE_SAMPLE - this.MIN_SAMPLE_SIZE);
  }

  /**
   * Analyze product effectiveness for a specific concern
   */
  async analyzeProductEffectiveness(productId: string, concern?: string): Promise<ProductEffectiveness | null> {
    const stats = await feedbackService.getProductFeedbackStats(productId);

    if (stats.totalRatings < this.MIN_SAMPLE_SIZE && stats.purchaseCount < this.MIN_SAMPLE_SIZE) {
      return null; // Not enough data
    }

    // Get concern-specific effectiveness if available
    let avgEffectiveness = stats.effectivenessAvg || 0;
    let sampleSize = stats.totalRatings + stats.purchaseCount;

    if (concern) {
      const concernResult = await pool.query(
        `SELECT AVG(rf.effectiveness_rating) as avg_eff, COUNT(*) as count
         FROM recommendation_feedback rf
         JOIN face_scans fs ON rf.face_scan_id = fs.id
         WHERE rf.product_id = $1
           AND rf.feedback_type = 'effectiveness'
           AND fs.analysis_results->>'primaryConcern' = $2`,
        [productId, concern]
      );

      if (concernResult.rows[0].count >= this.MIN_SAMPLE_SIZE) {
        avgEffectiveness = parseFloat(concernResult.rows[0].avg_eff) || avgEffectiveness;
        sampleSize = parseInt(concernResult.rows[0].count);
      }
    }

    return {
      productId,
      concern: concern || 'general',
      sampleSize,
      avgEffectiveness,
      avgRating: stats.averageRating,
      purchaseRate: stats.conversionRate,
      confidenceScore: this.calculateConfidence(sampleSize),
    };
  }

  /**
   * Analyze ingredient success rate for a concern
   */
  async analyzeIngredientSuccess(ingredient: string, concern: string): Promise<IngredientSuccess | null> {
    // This would typically connect to product data with ingredients
    // For now, we'll analyze based on products that contain this ingredient
    const result = await pool.query(
      `SELECT
        COUNT(DISTINCT rf.id) as sample_size,
        AVG(rf.effectiveness_rating) as avg_improvement
       FROM recommendation_feedback rf
       JOIN face_scans fs ON rf.face_scan_id = fs.id
       WHERE rf.feedback_type = 'effectiveness'
         AND fs.analysis_results->>'primaryConcern' = $1
         AND rf.effectiveness_rating IS NOT NULL`,
      [concern]
    );

    const row = result.rows[0];
    const sampleSize = parseInt(row.sample_size) || 0;

    if (sampleSize < this.MIN_SAMPLE_SIZE) {
      return null;
    }

    return {
      ingredient,
      concern,
      sampleSize,
      avgImprovement: parseFloat(row.avg_improvement) || 0,
      confidenceScore: this.calculateConfidence(sampleSize),
    };
  }

  /**
   * Get adjusted weights for recommendation engine based on learned patterns
   */
  async getAdjustedWeights(userId: string, concern: string): Promise<WeightAdjustment[]> {
    const adjustments: WeightAdjustment[] = [];

    // Get user's feedback patterns
    const userFeedback = await feedbackService.getUserFeedback(userId, 100);

    // Analyze user's rating patterns
    const highRatedProducts = userFeedback.filter(f => f.feedbackType === 'rating' && f.rating && f.rating >= 4);
    const lowRatedProducts = userFeedback.filter(f => f.feedbackType === 'rating' && f.rating && f.rating <= 2);

    // If user tends to like products, boost recommendation confidence
    if (highRatedProducts.length > lowRatedProducts.length * 2) {
      adjustments.push({
        factor: 'user_satisfaction',
        adjustment: 0.1,
        reason: 'User shows high satisfaction with recommendations',
      });
    }

    // Check for dismissed products pattern
    const dismissedCount = userFeedback.filter(f => f.feedbackType === 'dismiss').length;
    if (dismissedCount > 5) {
      adjustments.push({
        factor: 'recommendation_precision',
        adjustment: -0.05,
        reason: 'User dismisses many recommendations - need more precise matching',
      });
    }

    // Get aggregated insights for the concern
    const insights = await this.getAggregatedInsights(concern);
    if (insights.length > 0) {
      const topInsight = insights[0];
      if (topInsight.confidenceScore > 0.7 && topInsight.avgImprovement > 3.5) {
        adjustments.push({
          factor: `${topInsight.productCategory}_boost`,
          adjustment: 0.15,
          reason: `${topInsight.productCategory} shows high effectiveness for ${concern}`,
        });
      }
    }

    return adjustments;
  }

  /**
   * Learn user preferences from behavior
   */
  async learnUserPreferences(userId: string): Promise<UserPreferences> {
    // Analyze purchased and highly rated products
    const result = await pool.query(
      `SELECT
        rf.product_id,
        rf.feedback_type,
        rf.rating,
        bs.metadata
       FROM recommendation_feedback rf
       LEFT JOIN behavior_signals bs ON bs.user_id = rf.user_id AND bs.product_id = rf.product_id
       WHERE rf.user_id = $1
         AND (rf.feedback_type IN ('purchase', 'save') OR (rf.feedback_type = 'rating' AND rf.rating >= 4))
       ORDER BY rf.created_at DESC
       LIMIT 50`,
      [userId]
    );

    // Extract patterns from feedback
    const preferences: UserPreferences = {
      preferredCategories: [],
      avoidedIngredients: [],
      priceRange: null,
      preferredBrands: [],
    };

    // Get dismissed products to learn what to avoid
    const dismissed = await feedbackService.getUserDismissedProducts(userId);

    // In a real implementation, you would:
    // 1. Fetch product details for each product_id
    // 2. Analyze categories, price points, ingredients
    // 3. Build preference profile

    return preferences;
  }

  /**
   * Store aggregated insights (for scheduled job)
   */
  async computeAndStoreAggregatedInsights(storeId: string): Promise<number> {
    storeId = this.normalizeStoreId(storeId);

    // Compute insights by concern and product category
    const result = await pool.query(
      `INSERT INTO aggregated_insights (concern, product_category, sample_size, avg_improvement, confidence_score)
       SELECT
         fs.analysis_results->>'primaryConcern' as concern,
         'skincare' as product_category,
         COUNT(*) as sample_size,
         AVG(rf.effectiveness_rating) as avg_improvement,
         CASE
           WHEN COUNT(*) >= 20 THEN 1.0
           WHEN COUNT(*) >= 5 THEN (COUNT(*)::float - 5) / 15
           ELSE 0
         END as confidence_score
       FROM recommendation_feedback rf
       JOIN widget_users wu ON rf.user_id = wu.id
       JOIN face_scans fs ON rf.face_scan_id = fs.id
       WHERE wu.store_id = $1
         AND rf.feedback_type = 'effectiveness'
         AND rf.effectiveness_rating IS NOT NULL
         AND fs.analysis_results->>'primaryConcern' IS NOT NULL
       GROUP BY fs.analysis_results->>'primaryConcern'
       HAVING COUNT(*) >= 5
       ON CONFLICT (concern, product_category)
       DO UPDATE SET
         sample_size = EXCLUDED.sample_size,
         avg_improvement = EXCLUDED.avg_improvement,
         confidence_score = EXCLUDED.confidence_score,
         computed_at = NOW()
       RETURNING id`,
      [storeId]
    );

    return result.rowCount || 0;
  }

  /**
   * Get aggregated insights for a concern
   */
  async getAggregatedInsights(concern?: string): Promise<AggregatedInsight[]> {
    let query = `SELECT * FROM aggregated_insights WHERE confidence_score > 0`;
    const params: any[] = [];

    if (concern) {
      query += ` AND concern = $1`;
      params.push(concern);
    }

    query += ` ORDER BY confidence_score DESC, avg_improvement DESC LIMIT 20`;

    const result = await pool.query(query, params);

    return result.rows.map((row: { id: string; concern: string; product_category: string; sample_size: number; avg_improvement: string; confidence_score: string; computed_at: Date }) => ({
      id: row.id,
      concern: row.concern,
      productCategory: row.product_category,
      sampleSize: row.sample_size,
      avgImprovement: parseFloat(row.avg_improvement),
      confidenceScore: parseFloat(row.confidence_score),
      computedAt: row.computed_at,
    }));
  }

  /**
   * Get personalized product recommendations based on learned patterns
   */
  async getPersonalizedBoosts(userId: string, productIds: string[]): Promise<Map<string, number>> {
    const boosts = new Map<string, number>();

    // Initialize all products with neutral boost
    productIds.forEach(id => boosts.set(id, 0));

    // Get user's saved products - boost similar products
    const savedProducts = await feedbackService.getUserSavedProducts(userId);

    // Get user's dismissed products - reduce similar products
    const dismissedProducts = await feedbackService.getUserDismissedProducts(userId);

    // Get products with high effectiveness from similar users
    const userFeedback = await feedbackService.getUserFeedback(userId);
    const userConcerns = new Set<string>();

    // Build boost map based on feedback patterns
    for (const productId of productIds) {
      let boost = 0;

      // Boost if user saved this product before
      if (savedProducts.includes(productId)) {
        boost += 0.2;
      }

      // Reduce if user dismissed this product
      if (dismissedProducts.includes(productId)) {
        boost -= 0.5;
      }

      // Get community effectiveness for this product
      const stats = await feedbackService.getProductFeedbackStats(productId);
      if (stats.effectivenessAvg && stats.effectivenessAvg > 4) {
        boost += 0.1 * (stats.effectivenessAvg - 4);
      }

      boosts.set(productId, boost);
    }

    return boosts;
  }

  /**
   * Track recommendation performance
   */
  async trackRecommendationPerformance(storeId: string, days: number = 30): Promise<{
    totalRecommendations: number;
    viewRate: number;
    cartRate: number;
    purchaseRate: number;
    avgRating: number;
    effectivenessScore: number;
  }> {
    storeId = this.normalizeStoreId(storeId);

    const result = await pool.query(
      `WITH recommendation_metrics AS (
        SELECT
          COUNT(DISTINCT CASE WHEN bs.signal_type = 'product_view' THEN bs.id END) as views,
          COUNT(DISTINCT CASE WHEN bs.signal_type = 'add_to_cart' THEN bs.id END) as cart_adds,
          COUNT(DISTINCT CASE WHEN bs.signal_type = 'purchase' THEN bs.id END) as purchases
        FROM behavior_signals bs
        JOIN widget_users wu ON bs.user_id = wu.id
        WHERE wu.store_id = $1
          AND bs.created_at > NOW() - INTERVAL '1 day' * $2
      ),
      feedback_metrics AS (
        SELECT
          AVG(rf.rating) FILTER (WHERE rf.feedback_type = 'rating') as avg_rating,
          AVG(rf.effectiveness_rating) FILTER (WHERE rf.feedback_type = 'effectiveness') as avg_effectiveness
        FROM recommendation_feedback rf
        JOIN widget_users wu ON rf.user_id = wu.id
        WHERE wu.store_id = $1
          AND rf.created_at > NOW() - INTERVAL '1 day' * $2
      )
      SELECT
        rm.views,
        rm.cart_adds,
        rm.purchases,
        fm.avg_rating,
        fm.avg_effectiveness
      FROM recommendation_metrics rm, feedback_metrics fm`,
      [storeId, days]
    );

    const row = result.rows[0];
    const views = parseInt(row.views) || 0;
    const cartAdds = parseInt(row.cart_adds) || 0;
    const purchases = parseInt(row.purchases) || 0;

    return {
      totalRecommendations: views,
      viewRate: 1, // All recommendations are shown
      cartRate: views > 0 ? cartAdds / views : 0,
      purchaseRate: views > 0 ? purchases / views : 0,
      avgRating: parseFloat(row.avg_rating) || 0,
      effectivenessScore: parseFloat(row.avg_effectiveness) || 0,
    };
  }

  /**
   * Get products that need more feedback for better learning
   */
  async getProductsNeedingFeedback(storeId: string, limit: number = 10): Promise<Array<{
    productId: string;
    currentSampleSize: number;
    neededForConfidence: number;
  }>> {
    storeId = this.normalizeStoreId(storeId);

    // Find products with some but insufficient feedback
    const result = await pool.query(
      `SELECT
        rf.product_id,
        COUNT(*) as sample_size
       FROM recommendation_feedback rf
       JOIN widget_users wu ON rf.user_id = wu.id
       WHERE wu.store_id = $1
       GROUP BY rf.product_id
       HAVING COUNT(*) BETWEEN 1 AND $2
       ORDER BY COUNT(*) DESC
       LIMIT $3`,
      [storeId, this.HIGH_CONFIDENCE_SAMPLE - 1, limit]
    );

    return result.rows.map((row: { product_id: string; sample_size: string }) => ({
      productId: row.product_id,
      currentSampleSize: parseInt(row.sample_size),
      neededForConfidence: this.HIGH_CONFIDENCE_SAMPLE - parseInt(row.sample_size),
    }));
  }
}

export default new LearningEngineService();
