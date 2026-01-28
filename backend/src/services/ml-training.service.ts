/**
 * ML Training Data Collection Service
 *
 * Collects user feedback on scan results for continuous model improvement.
 * Enables dermatologist labeling and accuracy tracking.
 *
 * Version: 1.0.0
 */

import pool from '../config/database';

// =============================================================================
// INTERFACES
// =============================================================================

export interface ScanFeedback {
  scanId: string;
  userId: string;
  feedbackType: 'correction' | 'confirmation' | 'expert_label';
  attribute: string; // acne, dark_circles, pigmentation, etc.
  originalScore: number;
  originalGrade: number;
  userCorrectedGrade?: number; // What the user thinks it should be (0-4)
  expertLabel?: number; // Dermatologist label (0-4)
  confidence?: number; // User's confidence in their feedback (0-1)
  notes?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export interface TrainingDataPoint {
  id: string;
  imageUrl: string;
  attribute: string;
  aiPrediction: number;
  humanLabel: number;
  labelSource: 'user' | 'expert' | 'dermatologist';
  confidence: number;
  createdAt: Date;
  usedInTraining: boolean;
}

export interface AccuracyMetrics {
  attribute: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  meanAbsoluteError: number;
  overPredictionRate: number; // How often AI over-reports
  underPredictionRate: number; // How often AI under-reports
  lastUpdated: Date;
}

// =============================================================================
// ML TRAINING SERVICE
// =============================================================================

class MLTrainingService {

  /**
   * Record user feedback on a scan result
   */
  async recordFeedback(feedback: ScanFeedback): Promise<{ success: boolean; id?: string; message?: string }> {
    try {
      const result = await pool.query(`
        INSERT INTO scan_feedback (
          scan_id, user_id, feedback_type, attribute,
          original_score, original_grade, user_corrected_grade,
          expert_label, confidence, notes, image_url, metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING id
      `, [
        feedback.scanId,
        feedback.userId,
        feedback.feedbackType,
        feedback.attribute,
        feedback.originalScore,
        feedback.originalGrade,
        feedback.userCorrectedGrade,
        feedback.expertLabel,
        feedback.confidence || 0.7,
        feedback.notes,
        feedback.imageUrl,
        JSON.stringify(feedback.metadata || {})
      ]);

      // Update accuracy metrics
      await this.updateAccuracyMetrics(feedback);

      return { success: true, id: result.rows[0].id };
    } catch (error: any) {
      console.error('Error recording feedback:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Batch record multiple feedbacks (for when user corrects multiple attributes)
   */
  async recordBatchFeedback(feedbacks: ScanFeedback[]): Promise<{ success: boolean; count: number }> {
    let successCount = 0;

    for (const feedback of feedbacks) {
      const result = await this.recordFeedback(feedback);
      if (result.success) successCount++;
    }

    return { success: successCount > 0, count: successCount };
  }

  /**
   * Get accuracy metrics for all attributes
   */
  async getAccuracyMetrics(): Promise<AccuracyMetrics[]> {
    try {
      const result = await pool.query(`
        SELECT
          attribute,
          COUNT(*) as total_predictions,
          SUM(CASE WHEN ABS(original_grade - COALESCE(user_corrected_grade, expert_label)) <= 1 THEN 1 ELSE 0 END) as correct_predictions,
          AVG(ABS(original_grade - COALESCE(user_corrected_grade, expert_label))) as mean_absolute_error,
          SUM(CASE WHEN original_grade > COALESCE(user_corrected_grade, expert_label) THEN 1 ELSE 0 END)::float / COUNT(*) as over_prediction_rate,
          SUM(CASE WHEN original_grade < COALESCE(user_corrected_grade, expert_label) THEN 1 ELSE 0 END)::float / COUNT(*) as under_prediction_rate,
          MAX(created_at) as last_updated
        FROM scan_feedback
        WHERE user_corrected_grade IS NOT NULL OR expert_label IS NOT NULL
        GROUP BY attribute
      `);

      return result.rows.map(row => ({
        attribute: row.attribute,
        totalPredictions: parseInt(row.total_predictions),
        correctPredictions: parseInt(row.correct_predictions),
        accuracy: row.total_predictions > 0 ? row.correct_predictions / row.total_predictions : 0,
        meanAbsoluteError: parseFloat(row.mean_absolute_error) || 0,
        overPredictionRate: parseFloat(row.over_prediction_rate) || 0,
        underPredictionRate: parseFloat(row.under_prediction_rate) || 0,
        lastUpdated: row.last_updated
      }));
    } catch (error) {
      console.error('Error getting accuracy metrics:', error);
      return [];
    }
  }

  /**
   * Get training data for model retraining
   */
  async getTrainingData(options: {
    attribute?: string;
    minConfidence?: number;
    labelSource?: 'user' | 'expert' | 'dermatologist';
    limit?: number;
    excludeUsedInTraining?: boolean;
  } = {}): Promise<TrainingDataPoint[]> {
    try {
      let query = `
        SELECT
          sf.id,
          sf.image_url,
          sf.attribute,
          sf.original_score as ai_prediction,
          COALESCE(sf.expert_label, sf.user_corrected_grade) as human_label,
          CASE
            WHEN sf.expert_label IS NOT NULL THEN 'expert'
            ELSE 'user'
          END as label_source,
          sf.confidence,
          sf.created_at,
          sf.used_in_training
        FROM scan_feedback sf
        WHERE (sf.user_corrected_grade IS NOT NULL OR sf.expert_label IS NOT NULL)
          AND sf.image_url IS NOT NULL
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (options.attribute) {
        query += ` AND sf.attribute = $${paramIndex++}`;
        params.push(options.attribute);
      }

      if (options.minConfidence) {
        query += ` AND sf.confidence >= $${paramIndex++}`;
        params.push(options.minConfidence);
      }

      if (options.excludeUsedInTraining) {
        query += ` AND (sf.used_in_training = false OR sf.used_in_training IS NULL)`;
      }

      query += ` ORDER BY sf.confidence DESC, sf.created_at DESC`;

      if (options.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
      }

      const result = await pool.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        imageUrl: row.image_url,
        attribute: row.attribute,
        aiPrediction: row.ai_prediction,
        humanLabel: row.human_label,
        labelSource: row.label_source,
        confidence: row.confidence,
        createdAt: row.created_at,
        usedInTraining: row.used_in_training || false
      }));
    } catch (error) {
      console.error('Error getting training data:', error);
      return [];
    }
  }

  /**
   * Mark training data as used
   */
  async markTrainingDataUsed(ids: string[]): Promise<boolean> {
    try {
      await pool.query(`
        UPDATE scan_feedback
        SET used_in_training = true, training_used_at = NOW()
        WHERE id = ANY($1)
      `, [ids]);
      return true;
    } catch (error) {
      console.error('Error marking training data as used:', error);
      return false;
    }
  }

  /**
   * Calculate and store updated thresholds based on feedback
   */
  async calculateOptimalThresholds(attribute: string): Promise<{
    recommendedAdjustment: number;
    currentBias: 'over' | 'under' | 'neutral';
    sampleSize: number;
  }> {
    try {
      const result = await pool.query(`
        SELECT
          AVG(original_grade - COALESCE(user_corrected_grade, expert_label)) as bias,
          COUNT(*) as sample_size
        FROM scan_feedback
        WHERE attribute = $1
          AND (user_corrected_grade IS NOT NULL OR expert_label IS NOT NULL)
          AND confidence >= 0.6
      `, [attribute]);

      const bias = parseFloat(result.rows[0]?.bias) || 0;
      const sampleSize = parseInt(result.rows[0]?.sample_size) || 0;

      return {
        recommendedAdjustment: -bias, // Negative of bias to correct it
        currentBias: bias > 0.3 ? 'over' : bias < -0.3 ? 'under' : 'neutral',
        sampleSize
      };
    } catch (error) {
      console.error('Error calculating thresholds:', error);
      return { recommendedAdjustment: 0, currentBias: 'neutral', sampleSize: 0 };
    }
  }

  /**
   * Update accuracy metrics incrementally
   */
  private async updateAccuracyMetrics(feedback: ScanFeedback): Promise<void> {
    try {
      const humanLabel = feedback.expertLabel ?? feedback.userCorrectedGrade;
      if (humanLabel === undefined) return;

      const isCorrect = Math.abs(feedback.originalGrade - humanLabel) <= 1;
      const error = Math.abs(feedback.originalGrade - humanLabel);
      const isOverPrediction = feedback.originalGrade > humanLabel;
      const isUnderPrediction = feedback.originalGrade < humanLabel;

      await pool.query(`
        INSERT INTO ml_accuracy_metrics (
          attribute, total_predictions, correct_predictions,
          total_error, over_predictions, under_predictions, last_updated
        ) VALUES ($1, 1, $2, $3, $4, $5, NOW())
        ON CONFLICT (attribute) DO UPDATE SET
          total_predictions = ml_accuracy_metrics.total_predictions + 1,
          correct_predictions = ml_accuracy_metrics.correct_predictions + $2,
          total_error = ml_accuracy_metrics.total_error + $3,
          over_predictions = ml_accuracy_metrics.over_predictions + $4,
          under_predictions = ml_accuracy_metrics.under_predictions + $5,
          last_updated = NOW()
      `, [
        feedback.attribute,
        isCorrect ? 1 : 0,
        error,
        isOverPrediction ? 1 : 0,
        isUnderPrediction ? 1 : 0
      ]);
    } catch (error) {
      console.error('Error updating accuracy metrics:', error);
    }
  }

  /**
   * Get summary statistics for admin dashboard
   */
  async getDashboardStats(): Promise<{
    totalFeedback: number;
    feedbackByAttribute: Record<string, number>;
    overallAccuracy: number;
    recentTrend: 'improving' | 'declining' | 'stable';
    attributesNeedingAttention: string[];
  }> {
    try {
      // Total feedback
      const totalResult = await pool.query(`
        SELECT COUNT(*) as total FROM scan_feedback
      `);
      const totalFeedback = parseInt(totalResult.rows[0].total);

      // Feedback by attribute
      const byAttrResult = await pool.query(`
        SELECT attribute, COUNT(*) as count
        FROM scan_feedback
        GROUP BY attribute
      `);
      const feedbackByAttribute: Record<string, number> = {};
      byAttrResult.rows.forEach(row => {
        feedbackByAttribute[row.attribute] = parseInt(row.count);
      });

      // Overall accuracy
      const accuracyResult = await pool.query(`
        SELECT
          SUM(CASE WHEN ABS(original_grade - COALESCE(user_corrected_grade, expert_label)) <= 1 THEN 1 ELSE 0 END)::float /
          NULLIF(COUNT(*), 0) as accuracy
        FROM scan_feedback
        WHERE user_corrected_grade IS NOT NULL OR expert_label IS NOT NULL
      `);
      const overallAccuracy = parseFloat(accuracyResult.rows[0]?.accuracy) || 0;

      // Recent trend (compare last 7 days to previous 7 days)
      const trendResult = await pool.query(`
        SELECT
          (SELECT AVG(ABS(original_grade - COALESCE(user_corrected_grade, expert_label)))
           FROM scan_feedback
           WHERE created_at > NOW() - INTERVAL '7 days'
             AND (user_corrected_grade IS NOT NULL OR expert_label IS NOT NULL)) as recent_error,
          (SELECT AVG(ABS(original_grade - COALESCE(user_corrected_grade, expert_label)))
           FROM scan_feedback
           WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
             AND (user_corrected_grade IS NOT NULL OR expert_label IS NOT NULL)) as prev_error
      `);
      const recentError = parseFloat(trendResult.rows[0]?.recent_error) || 0;
      const prevError = parseFloat(trendResult.rows[0]?.prev_error) || recentError;
      const recentTrend = recentError < prevError - 0.1 ? 'improving' :
                         recentError > prevError + 0.1 ? 'declining' : 'stable';

      // Attributes needing attention (accuracy < 60% or high over-prediction)
      const attentionResult = await pool.query(`
        SELECT attribute
        FROM scan_feedback
        WHERE user_corrected_grade IS NOT NULL OR expert_label IS NOT NULL
        GROUP BY attribute
        HAVING
          SUM(CASE WHEN ABS(original_grade - COALESCE(user_corrected_grade, expert_label)) <= 1 THEN 1 ELSE 0 END)::float /
          NULLIF(COUNT(*), 0) < 0.6
          OR
          SUM(CASE WHEN original_grade > COALESCE(user_corrected_grade, expert_label) THEN 1 ELSE 0 END)::float /
          NULLIF(COUNT(*), 0) > 0.5
      `);
      const attributesNeedingAttention = attentionResult.rows.map(r => r.attribute);

      return {
        totalFeedback,
        feedbackByAttribute,
        overallAccuracy,
        recentTrend,
        attributesNeedingAttention
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return {
        totalFeedback: 0,
        feedbackByAttribute: {},
        overallAccuracy: 0,
        recentTrend: 'stable',
        attributesNeedingAttention: []
      };
    }
  }
}

export const mlTrainingService = new MLTrainingService();
export default mlTrainingService;
