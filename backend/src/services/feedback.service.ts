import { pool } from '../config/database';

// Types
interface RecommendationFeedback {
  id: string;
  userId: string;
  productId: string;
  faceScanId?: string;
  feedbackType: 'rating' | 'purchase' | 'dismiss' | 'save' | 'effectiveness';
  rating?: number;
  effectivenessRating?: number;
  comment?: string;
  createdAt: Date;
}

interface BehaviorSignal {
  id: string;
  userId: string;
  signalType: 'product_view' | 'add_to_cart' | 'purchase' | 'remove_from_cart' | 'wishlist_add' | 'compare';
  productId: string;
  faceScanId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

interface ProductFeedbackStats {
  productId: string;
  totalRatings: number;
  averageRating: number;
  purchaseCount: number;
  dismissCount: number;
  saveCount: number;
  effectivenessAvg: number | null;
  viewCount: number;
  cartAddCount: number;
  conversionRate: number;
}

class FeedbackService {
  // Demo store ID for development
  private readonly DEMO_STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

  private normalizeStoreId(storeId: string): string {
    if (storeId === 'demo-store' || storeId === 'demo_store') {
      return this.DEMO_STORE_ID;
    }
    return storeId;
  }

  /**
   * Record explicit feedback on a product recommendation
   */
  async recordFeedback(params: {
    userId: string;
    storeId: string;
    productId: string;
    faceScanId?: string;
    feedbackType: 'rating' | 'purchase' | 'dismiss' | 'save' | 'effectiveness' | 'helpful' | 'not_helpful';
    rating?: number;
    effectivenessRating?: number;
    comment?: string;
  }): Promise<RecommendationFeedback> {
    const { userId, storeId, productId, faceScanId, feedbackType, rating, effectivenessRating, comment } = params;

    const normalizedStoreId = this.normalizeStoreId(storeId);

    // Validate rating values
    if (feedbackType === 'rating' && (rating === undefined || rating < 1 || rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }
    if (feedbackType === 'effectiveness' && (effectivenessRating === undefined || effectivenessRating < 1 || effectivenessRating > 5)) {
      throw new Error('Effectiveness rating must be between 1 and 5');
    }

    // Map feedback types to schema
    const purchased = feedbackType === 'purchase';

    const result = await pool.query(
      `INSERT INTO recommendation_feedback
        (user_id, store_id, product_id, face_scan_id, feedback_type, rating, effectiveness_rating, feedback_text, purchased, purchase_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        normalizedStoreId,
        productId,
        faceScanId || null,
        feedbackType,
        rating || null,
        effectivenessRating || null,
        comment || null,
        purchased,
        purchased ? new Date() : null
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      faceScanId: row.face_scan_id,
      feedbackType: row.feedback_type,
      rating: row.rating,
      effectivenessRating: row.effectiveness_rating,
      comment: row.feedback_text,
      createdAt: row.created_at,
    };
  }

  /**
   * Record a behavior signal (implicit feedback)
   */
  async recordBehaviorSignal(params: {
    userId: string;
    storeId: string;
    signalType: 'product_view' | 'add_to_cart' | 'purchase' | 'remove_from_cart' | 'wishlist_add' | 'compare' | 'product_click';
    productId: string;
    faceScanId?: string;
    sessionId?: string;
    durationSeconds?: number;
    metadata?: Record<string, any>;
  }): Promise<BehaviorSignal> {
    const { userId, storeId, signalType, productId, faceScanId, sessionId, durationSeconds, metadata } = params;

    const normalizedStoreId = this.normalizeStoreId(storeId);

    const result = await pool.query(
      `INSERT INTO behavior_signals
        (user_id, store_id, signal_type, product_id, face_scan_id, session_id, duration_seconds, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        normalizedStoreId,
        signalType,
        productId,
        faceScanId || null,
        sessionId || null,
        durationSeconds || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      signalType: row.signal_type,
      productId: row.product_id,
      faceScanId: row.face_scan_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }

  /**
   * Get user's feedback history
   */
  async getUserFeedback(userId: string, limit: number = 50): Promise<RecommendationFeedback[]> {
    const result = await pool.query(
      `SELECT * FROM recommendation_feedback
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      faceScanId: row.face_scan_id,
      feedbackType: row.feedback_type,
      rating: row.rating,
      effectivenessRating: row.effectiveness_rating,
      comment: row.feedback_text,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get user's saved/helpful products
   */
  async getUserSavedProducts(userId: string): Promise<string[]> {
    const result = await pool.query(
      `SELECT product_id, MAX(created_at) as latest
       FROM recommendation_feedback
       WHERE user_id = $1 AND feedback_type IN ('save', 'helpful')
       GROUP BY product_id
       ORDER BY latest DESC`,
      [userId]
    );

    return result.rows.map((row: { product_id: string }) => row.product_id);
  }

  /**
   * Get user's dismissed products
   */
  async getUserDismissedProducts(userId: string): Promise<string[]> {
    const result = await pool.query(
      `SELECT DISTINCT product_id FROM recommendation_feedback
       WHERE user_id = $1 AND feedback_type IN ('dismiss', 'dismissed', 'not_helpful')`,
      [userId]
    );

    return result.rows.map((row: { product_id: string }) => row.product_id);
  }

  /**
   * Get user's purchased products
   */
  async getUserPurchasedProducts(userId: string): Promise<string[]> {
    const result = await pool.query(
      `SELECT product_id, MAX(created_at) as latest
       FROM recommendation_feedback
       WHERE user_id = $1 AND (feedback_type = 'purchase' OR purchased = true)
       GROUP BY product_id
       ORDER BY latest DESC`,
      [userId]
    );

    return result.rows.map((row: { product_id: string }) => row.product_id);
  }

  /**
   * Check if user has provided feedback for a product
   */
  async hasUserFeedback(userId: string, productId: string, feedbackType?: string): Promise<boolean> {
    let query = `SELECT 1 FROM recommendation_feedback WHERE user_id = $1 AND product_id = $2`;
    const params: (string | undefined)[] = [userId, productId];

    if (feedbackType) {
      query += ` AND feedback_type = $3`;
      params.push(feedbackType);
    }

    const result = await pool.query(query + ' LIMIT 1', params);
    return result.rows.length > 0;
  }

  /**
   * Remove saved product (unsave)
   */
  async removeSavedProduct(userId: string, productId: string): Promise<void> {
    await pool.query(
      `DELETE FROM recommendation_feedback
       WHERE user_id = $1 AND product_id = $2 AND feedback_type IN ('save', 'helpful')`,
      [userId, productId]
    );
  }

  /**
   * Get product feedback statistics (for learning engine)
   */
  async getProductFeedbackStats(productId: string): Promise<ProductFeedbackStats> {
    // Get explicit feedback stats
    const feedbackResult = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE feedback_type = 'rating' AND rating IS NOT NULL) as total_ratings,
        AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating,
        COUNT(*) FILTER (WHERE feedback_type = 'purchase' OR purchased = true) as purchase_count,
        COUNT(*) FILTER (WHERE feedback_type IN ('dismiss', 'dismissed', 'not_helpful')) as dismiss_count,
        COUNT(*) FILTER (WHERE feedback_type IN ('save', 'helpful')) as save_count,
        AVG(effectiveness_rating) FILTER (WHERE effectiveness_rating IS NOT NULL) as effectiveness_avg
       FROM recommendation_feedback
       WHERE product_id = $1`,
      [productId]
    );

    // Get behavior signal stats
    const behaviorResult = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE signal_type = 'product_view') as view_count,
        COUNT(*) FILTER (WHERE signal_type = 'add_to_cart') as cart_add_count,
        COUNT(*) FILTER (WHERE signal_type = 'purchase') as behavior_purchase_count
       FROM behavior_signals
       WHERE product_id = $1`,
      [productId]
    );

    const feedback = feedbackResult.rows[0];
    const behavior = behaviorResult.rows[0];

    const viewCount = parseInt(behavior.view_count) || 0;
    const purchaseCount = (parseInt(feedback.purchase_count) || 0) + (parseInt(behavior.behavior_purchase_count) || 0);
    const conversionRate = viewCount > 0 ? purchaseCount / viewCount : 0;

    return {
      productId,
      totalRatings: parseInt(feedback.total_ratings) || 0,
      averageRating: parseFloat(feedback.avg_rating) || 0,
      purchaseCount,
      dismissCount: parseInt(feedback.dismiss_count) || 0,
      saveCount: parseInt(feedback.save_count) || 0,
      effectivenessAvg: feedback.effectiveness_avg ? parseFloat(feedback.effectiveness_avg) : null,
      viewCount,
      cartAddCount: parseInt(behavior.cart_add_count) || 0,
      conversionRate,
    };
  }

  /**
   * Get aggregated feedback for a store's products
   */
  async getStoreFeedbackSummary(storeId: string): Promise<{
    totalFeedback: number;
    totalSignals: number;
    topRatedProducts: Array<{ productId: string; avgRating: number; count: number }>;
    mostPurchased: Array<{ productId: string; count: number }>;
    mostViewed: Array<{ productId: string; count: number }>;
  }> {
    storeId = this.normalizeStoreId(storeId);

    // Get total feedback count
    const feedbackCount = await pool.query(
      `SELECT COUNT(*) FROM recommendation_feedback rf
       JOIN widget_users wu ON rf.user_id = wu.id
       WHERE wu.store_id = $1`,
      [storeId]
    );

    // Get total signals count
    const signalCount = await pool.query(
      `SELECT COUNT(*) FROM behavior_signals bs
       JOIN widget_users wu ON bs.user_id = wu.id
       WHERE wu.store_id = $1`,
      [storeId]
    );

    // Get top rated products
    const topRated = await pool.query(
      `SELECT rf.product_id, AVG(rf.rating) as avg_rating, COUNT(*) as count
       FROM recommendation_feedback rf
       JOIN widget_users wu ON rf.user_id = wu.id
       WHERE wu.store_id = $1 AND rf.feedback_type = 'rating' AND rf.rating IS NOT NULL
       GROUP BY rf.product_id
       HAVING COUNT(*) >= 3
       ORDER BY avg_rating DESC, count DESC
       LIMIT 10`,
      [storeId]
    );

    // Get most purchased products
    const mostPurchased = await pool.query(
      `SELECT product_id, COUNT(*) as count
       FROM (
         SELECT rf.product_id FROM recommendation_feedback rf
         JOIN widget_users wu ON rf.user_id = wu.id
         WHERE wu.store_id = $1 AND rf.feedback_type = 'purchase'
         UNION ALL
         SELECT bs.product_id FROM behavior_signals bs
         JOIN widget_users wu ON bs.user_id = wu.id
         WHERE wu.store_id = $1 AND bs.signal_type = 'purchase'
       ) combined
       GROUP BY product_id
       ORDER BY count DESC
       LIMIT 10`,
      [storeId]
    );

    // Get most viewed products
    const mostViewed = await pool.query(
      `SELECT bs.product_id, COUNT(*) as count
       FROM behavior_signals bs
       JOIN widget_users wu ON bs.user_id = wu.id
       WHERE wu.store_id = $1 AND bs.signal_type = 'product_view'
       GROUP BY bs.product_id
       ORDER BY count DESC
       LIMIT 10`,
      [storeId]
    );

    return {
      totalFeedback: parseInt(feedbackCount.rows[0].count) || 0,
      totalSignals: parseInt(signalCount.rows[0].count) || 0,
      topRatedProducts: topRated.rows.map((r: { product_id: string; avg_rating: string; count: string }) => ({
        productId: r.product_id,
        avgRating: parseFloat(r.avg_rating),
        count: parseInt(r.count),
      })),
      mostPurchased: mostPurchased.rows.map((r: { product_id: string; count: string }) => ({
        productId: r.product_id,
        count: parseInt(r.count),
      })),
      mostViewed: mostViewed.rows.map((r: { product_id: string; count: string }) => ({
        productId: r.product_id,
        count: parseInt(r.count),
      })),
    };
  }

  /**
   * Request effectiveness feedback for purchased products
   */
  async getPendingEffectivenessFeedback(userId: string): Promise<Array<{
    productId: string;
    purchaseDate: Date;
    daysSincePurchase: number;
  }>> {
    // Get products purchased 2+ weeks ago that haven't received effectiveness feedback
    const result = await pool.query(
      `SELECT DISTINCT rf.product_id, MIN(rf.created_at) as purchase_date
       FROM recommendation_feedback rf
       WHERE rf.user_id = $1
         AND rf.feedback_type = 'purchase'
         AND rf.created_at < NOW() - INTERVAL '14 days'
         AND NOT EXISTS (
           SELECT 1 FROM recommendation_feedback ef
           WHERE ef.user_id = rf.user_id
             AND ef.product_id = rf.product_id
             AND ef.feedback_type = 'effectiveness'
         )
       GROUP BY rf.product_id
       ORDER BY purchase_date ASC
       LIMIT 5`,
      [userId]
    );

    return result.rows.map((row: { product_id: string; purchase_date: Date }) => ({
      productId: row.product_id,
      purchaseDate: row.purchase_date,
      daysSincePurchase: Math.floor((Date.now() - new Date(row.purchase_date).getTime()) / (1000 * 60 * 60 * 24)),
    }));
  }
}

export default new FeedbackService();
