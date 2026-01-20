import { pool } from '../config/database';

// Types
interface PredictionPoint {
  date: Date;
  predictedValue: number;
  confidenceLow: number;
  confidenceHigh: number;
}

interface GoalPrediction {
  goalId: string;
  goalName: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  predictions: PredictionPoint[];
  expectedCompletionDate: Date | null;
  confidenceScore: number;
  improvementRate: number; // Per week
}

interface MetricPrediction {
  metric: string;
  currentValue: number;
  predictions: PredictionPoint[];
  trend: 'improving' | 'stable' | 'declining';
  weeklyChange: number;
}

interface FacePreviewData {
  id: string;
  userId: string;
  faceScanId: string;
  previewType: 'overlay' | 'side_by_side' | 'progress_map';
  timeframeWeeks: number;
  improvements: {
    area: string;
    currentSeverity: number;
    predictedSeverity: number;
    improvementPercent: number;
    coordinates?: { x: number; y: number; radius: number }[];
  }[];
  overallImprovement: number;
  createdAt: Date;
}

// Typical improvement rates by concern (% per week with consistent routine)
const IMPROVEMENT_RATES: Record<string, { baseRate: number; variance: number; maxWeeks: number }> = {
  acne_score: { baseRate: 3.5, variance: 1.5, maxWeeks: 12 },
  wrinkle_score: { baseRate: 1.2, variance: 0.5, maxWeeks: 24 },
  hydration_score: { baseRate: 5.0, variance: 2.0, maxWeeks: 6 },
  pigmentation_score: { baseRate: 2.0, variance: 1.0, maxWeeks: 16 },
  texture_score: { baseRate: 2.5, variance: 1.0, maxWeeks: 10 },
  redness_score: { baseRate: 3.0, variance: 1.5, maxWeeks: 8 },
  oiliness_score: { baseRate: 4.0, variance: 2.0, maxWeeks: 6 },
  skin_score: { baseRate: 2.0, variance: 1.0, maxWeeks: 12 },
};

// Metrics where lower is better
const LOWER_IS_BETTER = ['acne_score', 'wrinkle_score', 'pigmentation_score', 'redness_score', 'oiliness_score'];

class PredictionService {
  private readonly DEMO_STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

  private normalizeStoreId(storeId: string): string {
    if (storeId === 'demo-store' || storeId === 'demo_store') {
      return this.DEMO_STORE_ID;
    }
    return storeId;
  }

  /**
   * Generate predictions for a user's goal
   */
  async generateGoalPrediction(userId: string, goalId: string): Promise<GoalPrediction | null> {
    // Get goal details
    const goalResult = await pool.query(
      `SELECT * FROM user_goals WHERE id = $1 AND user_id = $2`,
      [goalId, userId]
    );

    if (goalResult.rows.length === 0) {
      return null;
    }

    const goal = goalResult.rows[0];
    const metric = goal.target_metric;
    const currentValue = goal.current_value || goal.baseline_value || 50;
    const targetValue = goal.target_value || 80;

    // Get historical progress data
    const historyResult = await pool.query(
      `SELECT snapshot_date, ${metric} as value
       FROM user_progress
       WHERE user_id = $1 AND ${metric} IS NOT NULL
       ORDER BY snapshot_date ASC`,
      [userId]
    );

    // Calculate actual improvement rate if we have history
    let improvementRate = IMPROVEMENT_RATES[metric]?.baseRate || 2.0;
    let variance = IMPROVEMENT_RATES[metric]?.variance || 1.0;

    if (historyResult.rows.length >= 2) {
      const actualRate = this.calculateActualImprovementRate(historyResult.rows, metric);
      if (actualRate !== null) {
        improvementRate = actualRate;
        variance = Math.abs(actualRate) * 0.3; // 30% variance from actual rate
      }
    }

    // Generate weekly predictions
    const predictions: PredictionPoint[] = [];
    const maxWeeks = IMPROVEMENT_RATES[metric]?.maxWeeks || 12;
    const lowerIsBetter = LOWER_IS_BETTER.includes(metric);

    let predictedValue = currentValue;
    let weeksToTarget: number | null = null;

    for (let week = 1; week <= maxWeeks; week++) {
      const weekDate = new Date();
      weekDate.setDate(weekDate.getDate() + week * 7);

      // Apply diminishing returns as we approach target
      const progressToTarget = lowerIsBetter
        ? (currentValue - predictedValue) / (currentValue - targetValue)
        : (predictedValue - currentValue) / (targetValue - currentValue);

      const diminishingFactor = Math.max(0.3, 1 - progressToTarget * 0.5);
      const weeklyChange = improvementRate * diminishingFactor;

      if (lowerIsBetter) {
        predictedValue = Math.max(targetValue, predictedValue - weeklyChange);
      } else {
        predictedValue = Math.min(targetValue, predictedValue + weeklyChange);
      }

      // Check if target reached
      if (weeksToTarget === null) {
        if ((lowerIsBetter && predictedValue <= targetValue) ||
            (!lowerIsBetter && predictedValue >= targetValue)) {
          weeksToTarget = week;
        }
      }

      predictions.push({
        date: weekDate,
        predictedValue: Math.round(predictedValue),
        confidenceLow: Math.round(predictedValue - variance * week * 0.5),
        confidenceHigh: Math.round(predictedValue + variance * week * 0.5),
      });
    }

    // Calculate expected completion date
    let expectedCompletionDate: Date | null = null;
    if (weeksToTarget !== null) {
      expectedCompletionDate = new Date();
      expectedCompletionDate.setDate(expectedCompletionDate.getDate() + weeksToTarget * 7);
    }

    // Calculate confidence score based on data availability
    const dataPoints = historyResult.rows.length;
    const confidenceScore = Math.min(1, 0.3 + dataPoints * 0.1);

    // Save predictions to database
    await this.savePredictions(userId, goalId, metric, predictions, confidenceScore);

    return {
      goalId,
      goalName: goal.goal_name || goal.goal_type,
      metric,
      currentValue,
      targetValue,
      predictions,
      expectedCompletionDate,
      confidenceScore,
      improvementRate,
    };
  }

  /**
   * Generate predictions for all active goals
   */
  async generateAllGoalPredictions(userId: string): Promise<GoalPrediction[]> {
    const goalsResult = await pool.query(
      `SELECT id FROM user_goals WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const predictions: GoalPrediction[] = [];

    for (const goal of goalsResult.rows) {
      const prediction = await this.generateGoalPrediction(userId, goal.id);
      if (prediction) {
        predictions.push(prediction);
      }
    }

    return predictions;
  }

  /**
   * Generate metric-specific predictions (without a goal)
   */
  async generateMetricPrediction(userId: string, metric: string, weeks: number = 8): Promise<MetricPrediction | null> {
    // Get current value from latest progress
    const currentResult = await pool.query(
      `SELECT ${metric} as value, snapshot_date
       FROM user_progress
       WHERE user_id = $1 AND ${metric} IS NOT NULL
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return null;
    }

    const currentValue = currentResult.rows[0].value;

    // Get historical data
    const historyResult = await pool.query(
      `SELECT snapshot_date, ${metric} as value
       FROM user_progress
       WHERE user_id = $1 AND ${metric} IS NOT NULL
       ORDER BY snapshot_date ASC`,
      [userId]
    );

    // Calculate trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    let weeklyChange = 0;

    if (historyResult.rows.length >= 2) {
      const actualRate = this.calculateActualImprovementRate(historyResult.rows, metric);
      if (actualRate !== null) {
        weeklyChange = actualRate;
        const lowerIsBetter = LOWER_IS_BETTER.includes(metric);

        if (Math.abs(actualRate) < 0.5) {
          trend = 'stable';
        } else if ((lowerIsBetter && actualRate < 0) || (!lowerIsBetter && actualRate > 0)) {
          trend = 'improving';
        } else {
          trend = 'declining';
        }
      }
    }

    // Generate predictions
    const predictions: PredictionPoint[] = [];
    const variance = IMPROVEMENT_RATES[metric]?.variance || 1.0;
    let predictedValue = currentValue;

    for (let week = 1; week <= weeks; week++) {
      const weekDate = new Date();
      weekDate.setDate(weekDate.getDate() + week * 7);

      predictedValue += weeklyChange;

      // Clamp values to reasonable range
      predictedValue = Math.max(0, Math.min(100, predictedValue));

      predictions.push({
        date: weekDate,
        predictedValue: Math.round(predictedValue),
        confidenceLow: Math.round(Math.max(0, predictedValue - variance * week)),
        confidenceHigh: Math.round(Math.min(100, predictedValue + variance * week)),
      });
    }

    return {
      metric,
      currentValue,
      predictions,
      trend,
      weeklyChange,
    };
  }

  /**
   * Generate face preview data (metadata for UI overlay)
   */
  async generateFacePreview(
    userId: string,
    faceScanId: string,
    timeframeWeeks: number = 8
  ): Promise<FacePreviewData | null> {
    // Get face scan analysis
    const scanResult = await pool.query(
      `SELECT id, analysis_results FROM face_scans WHERE id = $1`,
      [faceScanId]
    );

    if (scanResult.rows.length === 0) {
      return null;
    }

    const analysis = scanResult.rows[0].analysis_results || {};

    // Get user's active goals for context
    const goalsResult = await pool.query(
      `SELECT target_metric FROM user_goals WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const activeMetrics = goalsResult.rows.map((g: { target_metric: string }) => g.target_metric);

    // Generate improvement predictions for detected issues
    const improvements: FacePreviewData['improvements'] = [];

    // Map analysis concerns to metrics
    const concernMetricMap: Record<string, string> = {
      acne: 'acne_score',
      pimples: 'acne_score',
      wrinkles: 'wrinkle_score',
      fine_lines: 'wrinkle_score',
      dark_spots: 'pigmentation_score',
      hyperpigmentation: 'pigmentation_score',
      redness: 'redness_score',
      dryness: 'hydration_score',
      oiliness: 'oiliness_score',
      texture: 'texture_score',
    };

    // Process detected concerns
    const detectedConcerns = analysis.concerns || [];
    const detectedAreas = analysis.detectedAreas || [];

    for (const concern of detectedConcerns) {
      const metric = concernMetricMap[concern.toLowerCase()] || 'skin_score';
      const rates = IMPROVEMENT_RATES[metric] || { baseRate: 2.0, variance: 1.0 };

      // Calculate improvement based on whether user has active goal for this
      const hasGoal = activeMetrics.includes(metric);
      const improvementMultiplier = hasGoal ? 1.2 : 0.8; // Better improvement with active goal

      const totalImprovement = rates.baseRate * timeframeWeeks * improvementMultiplier;
      const currentSeverity = analysis[metric] || 50;
      const lowerIsBetter = LOWER_IS_BETTER.includes(metric);

      let predictedSeverity: number;
      let improvementPercent: number;

      if (lowerIsBetter) {
        predictedSeverity = Math.max(10, currentSeverity - totalImprovement);
        improvementPercent = ((currentSeverity - predictedSeverity) / currentSeverity) * 100;
      } else {
        predictedSeverity = Math.min(95, currentSeverity + totalImprovement);
        improvementPercent = ((predictedSeverity - currentSeverity) / (100 - currentSeverity)) * 100;
      }

      improvements.push({
        area: concern,
        currentSeverity: Math.round(currentSeverity),
        predictedSeverity: Math.round(predictedSeverity),
        improvementPercent: Math.round(improvementPercent),
        coordinates: detectedAreas
          .filter((a: any) => a.type === concern)
          .map((a: any) => ({ x: a.x, y: a.y, radius: a.radius || 20 })),
      });
    }

    // Calculate overall improvement
    const overallImprovement = improvements.length > 0
      ? improvements.reduce((sum, i) => sum + i.improvementPercent, 0) / improvements.length
      : 0;

    // Save preview data
    const previewId = await this.saveFacePreview(userId, faceScanId, {
      previewType: 'progress_map',
      timeframeWeeks,
      improvements,
      overallImprovement,
    });

    return {
      id: previewId,
      userId,
      faceScanId,
      previewType: 'progress_map',
      timeframeWeeks,
      improvements,
      overallImprovement: Math.round(overallImprovement),
      createdAt: new Date(),
    };
  }

  /**
   * Get saved predictions for a goal
   */
  async getSavedPredictions(userId: string, goalId: string): Promise<PredictionPoint[]> {
    const result = await pool.query(
      `SELECT prediction_date, predicted_value, confidence_low, confidence_high
       FROM user_predictions
       WHERE user_id = $1 AND goal_id = $2
       ORDER BY prediction_date ASC`,
      [userId, goalId]
    );

    return result.rows.map((row: any) => ({
      date: row.prediction_date,
      predictedValue: row.predicted_value,
      confidenceLow: row.confidence_low,
      confidenceHigh: row.confidence_high,
    }));
  }

  /**
   * Get face preview history
   */
  async getFacePreviewHistory(userId: string, limit: number = 10): Promise<FacePreviewData[]> {
    const result = await pool.query(
      `SELECT * FROM face_previews
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      faceScanId: row.face_scan_id,
      previewType: row.preview_type,
      timeframeWeeks: row.timeframe_weeks,
      improvements: row.preview_data?.improvements || [],
      overallImprovement: row.preview_data?.overallImprovement || 0,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get progress summary with predictions
   */
  async getProgressSummary(userId: string): Promise<{
    currentScores: Record<string, number>;
    predictedScores: Record<string, number>;
    improvements: Record<string, number>;
    overallProgress: number;
    confidenceLevel: string;
  }> {
    // Get current scores from latest progress
    const currentResult = await pool.query(
      `SELECT skin_score, acne_score, wrinkle_score, hydration_score,
              pigmentation_score, texture_score, redness_score, oiliness_score
       FROM user_progress
       WHERE user_id = $1
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [userId]
    );

    const currentScores: Record<string, number> = {};
    const predictedScores: Record<string, number> = {};
    const improvements: Record<string, number> = {};

    if (currentResult.rows.length > 0) {
      const row = currentResult.rows[0];
      const metrics = ['skin_score', 'acne_score', 'wrinkle_score', 'hydration_score',
                       'pigmentation_score', 'texture_score', 'redness_score', 'oiliness_score'];

      for (const metric of metrics) {
        if (row[metric] !== null) {
          currentScores[metric] = row[metric];

          // Generate 4-week prediction
          const prediction = await this.generateMetricPrediction(userId, metric, 4);
          if (prediction && prediction.predictions.length > 0) {
            const lastPrediction = prediction.predictions[prediction.predictions.length - 1];
            predictedScores[metric] = lastPrediction.predictedValue;

            const lowerIsBetter = LOWER_IS_BETTER.includes(metric);
            if (lowerIsBetter) {
              improvements[metric] = currentScores[metric] - predictedScores[metric];
            } else {
              improvements[metric] = predictedScores[metric] - currentScores[metric];
            }
          }
        }
      }
    }

    // Calculate overall progress
    const improvementValues = Object.values(improvements);
    const overallProgress = improvementValues.length > 0
      ? improvementValues.reduce((sum, v) => sum + v, 0) / improvementValues.length
      : 0;

    // Determine confidence level
    const dataPoints = currentResult.rows.length;
    let confidenceLevel: string;
    if (dataPoints >= 4) {
      confidenceLevel = 'high';
    } else if (dataPoints >= 2) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    return {
      currentScores,
      predictedScores,
      improvements,
      overallProgress: Math.round(overallProgress * 10) / 10,
      confidenceLevel,
    };
  }

  /**
   * Calculate actual improvement rate from historical data
   */
  private calculateActualImprovementRate(history: any[], metric: string): number | null {
    if (history.length < 2) return null;

    const first = history[0];
    const last = history[history.length - 1];

    const daysDiff = Math.max(1, (new Date(last.snapshot_date).getTime() - new Date(first.snapshot_date).getTime()) / (1000 * 60 * 60 * 24));
    const weeksDiff = daysDiff / 7;

    if (weeksDiff < 0.5) return null;

    const valueDiff = last.value - first.value;
    const lowerIsBetter = LOWER_IS_BETTER.includes(metric);

    // For lower-is-better metrics, negative change is improvement
    return lowerIsBetter ? -valueDiff / weeksDiff : valueDiff / weeksDiff;
  }

  /**
   * Save predictions to database
   */
  private async savePredictions(
    userId: string,
    goalId: string,
    metric: string,
    predictions: PredictionPoint[],
    confidenceScore: number
  ): Promise<void> {
    // Delete old predictions for this goal
    await pool.query(
      `DELETE FROM user_predictions WHERE user_id = $1 AND goal_id = $2`,
      [userId, goalId]
    );

    // Insert new predictions
    for (const pred of predictions) {
      await pool.query(
        `INSERT INTO user_predictions
          (user_id, goal_id, metric, prediction_date, predicted_value, confidence_low, confidence_high, confidence_score, prediction_model)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, goalId, metric, pred.date, pred.predictedValue, pred.confidenceLow, pred.confidenceHigh, confidenceScore, 'linear_diminishing']
      );
    }
  }

  /**
   * Save face preview to database
   */
  private async saveFacePreview(
    userId: string,
    faceScanId: string,
    data: {
      previewType: string;
      timeframeWeeks: number;
      improvements: any[];
      overallImprovement: number;
    }
  ): Promise<string> {
    const result = await pool.query(
      `INSERT INTO face_previews
        (user_id, face_scan_id, preview_type, timeframe_weeks, preview_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, faceScanId, data.previewType, data.timeframeWeeks, JSON.stringify(data)]
    );

    return result.rows[0].id;
  }
}

export default new PredictionService();
