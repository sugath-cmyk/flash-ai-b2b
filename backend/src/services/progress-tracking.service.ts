import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';

interface ProgressSnapshot {
  id: string;
  userId: string;
  faceScanId: string;
  snapshotDate: string;
  skinScore: number | null;
  acneScore: number | null;
  wrinkleScore: number | null;
  hydrationScore: number | null;
  pigmentationScore: number | null;
  textureScore: number | null;
  rednessScore: number | null;
  oilinessScore: number | null;
  skinAgeEstimate: number | null;
  changes: Record<string, number>;
  imageUrl?: string;
}

interface CompareResult {
  before: ProgressSnapshot;
  after: ProgressSnapshot;
  changes: Record<string, number>;
  improvements: string[];
  declines: string[];
  daysBetween: number;
}

interface ChartDataPoint {
  date: string;
  value: number;
  scanId: string;
}

interface MilestoneData {
  id: string;
  milestoneType: string;
  milestoneName: string;
  achievedAt: string;
  metadata: Record<string, any>;
}

const MILESTONE_DEFINITIONS = {
  first_scan: { name: 'First Scan', description: 'Completed your first skin scan' },
  week_streak: { name: 'Week Warrior', description: 'Scanned for 7 days in a row' },
  improvement_10: { name: 'Making Progress', description: 'Improved a score by 10%' },
  improvement_25: { name: 'Transformation', description: 'Improved a score by 25%' },
  five_scans: { name: 'Dedicated', description: 'Completed 5 skin scans' },
  ten_scans: { name: 'Skincare Pro', description: 'Completed 10 skin scans' },
  goal_completed: { name: 'Goal Crusher', description: 'Completed a skincare goal' },
};

export class ProgressTrackingService {
  async getTimeline(userId: string, limit: number = 20): Promise<ProgressSnapshot[]> {
    const result = await pool.query(
      `SELECT
        up.*,
        fs.front_image_url as image_url
       FROM user_progress up
       LEFT JOIN face_scans fs ON up.face_scan_id = fs.id
       WHERE up.user_id = $1
       ORDER BY up.snapshot_date DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(this.formatSnapshot);
  }

  async getLatestProgress(userId: string): Promise<ProgressSnapshot | null> {
    const result = await pool.query(
      `SELECT
        up.*,
        fs.front_image_url as image_url
       FROM user_progress up
       LEFT JOIN face_scans fs ON up.face_scan_id = fs.id
       WHERE up.user_id = $1
       ORDER BY up.snapshot_date DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatSnapshot(result.rows[0]);
  }

  async compareScans(
    userId: string,
    beforeScanId: string,
    afterScanId: string
  ): Promise<CompareResult> {
    const snapshots = await pool.query(
      `SELECT
        up.*,
        fs.front_image_url as image_url
       FROM user_progress up
       LEFT JOIN face_scans fs ON up.face_scan_id = fs.id
       WHERE up.user_id = $1 AND up.face_scan_id IN ($2, $3)
       ORDER BY up.snapshot_date ASC`,
      [userId, beforeScanId, afterScanId]
    );

    if (snapshots.rows.length !== 2) {
      throw createError('Both scans must exist and belong to the user', 404);
    }

    const before = this.formatSnapshot(snapshots.rows[0]);
    const after = this.formatSnapshot(snapshots.rows[1]);

    const changes = this.calculateChanges(before, after);
    const improvements: string[] = [];
    const declines: string[] = [];

    Object.entries(changes).forEach(([metric, change]) => {
      if (change > 0) improvements.push(metric);
      else if (change < 0) declines.push(metric);
    });

    const daysBetween = Math.floor(
      (new Date(after.snapshotDate).getTime() - new Date(before.snapshotDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      before,
      after,
      changes,
      improvements,
      declines,
      daysBetween,
    };
  }

  async compareWithFirst(userId: string): Promise<CompareResult | null> {
    const snapshots = await pool.query(
      `SELECT
        up.*,
        fs.front_image_url as image_url
       FROM user_progress up
       LEFT JOIN face_scans fs ON up.face_scan_id = fs.id
       WHERE up.user_id = $1
       ORDER BY up.snapshot_date`,
      [userId]
    );

    if (snapshots.rows.length < 2) {
      return null;
    }

    const first = this.formatSnapshot(snapshots.rows[0]);
    const latest = this.formatSnapshot(snapshots.rows[snapshots.rows.length - 1]);

    const changes = this.calculateChanges(first, latest);
    const improvements: string[] = [];
    const declines: string[] = [];

    Object.entries(changes).forEach(([metric, change]) => {
      if (change > 0) improvements.push(metric);
      else if (change < 0) declines.push(metric);
    });

    const daysBetween = Math.floor(
      (new Date(latest.snapshotDate).getTime() - new Date(first.snapshotDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      before: first,
      after: latest,
      changes,
      improvements,
      declines,
      daysBetween,
    };
  }

  async getChartData(
    userId: string,
    metric: string,
    days: number = 90
  ): Promise<ChartDataPoint[]> {
    const columnMap: Record<string, string> = {
      skin: 'skin_score',
      acne: 'acne_score',
      wrinkles: 'wrinkle_score',
      hydration: 'hydration_score',
      pigmentation: 'pigmentation_score',
      texture: 'texture_score',
      redness: 'redness_score',
      oiliness: 'oiliness_score',
      age: 'skin_age_estimate',
    };

    const column = columnMap[metric.toLowerCase()];
    if (!column) {
      throw createError(`Invalid metric: ${metric}`, 400);
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const result = await pool.query(
      `SELECT
        snapshot_date as date,
        ${column} as value,
        face_scan_id as scan_id
       FROM user_progress
       WHERE user_id = $1 AND snapshot_date >= $2 AND ${column} IS NOT NULL
       ORDER BY snapshot_date ASC`,
      [userId, since]
    );

    return result.rows.map((row) => ({
      date: row.date,
      value: row.value,
      scanId: row.scan_id,
    }));
  }

  async getAllMetricsChartData(userId: string, days: number = 90): Promise<Record<string, ChartDataPoint[]>> {
    const metrics = ['skin', 'acne', 'wrinkles', 'hydration', 'pigmentation', 'texture', 'redness', 'oiliness'];
    const result: Record<string, ChartDataPoint[]> = {};

    for (const metric of metrics) {
      result[metric] = await this.getChartData(userId, metric, days);
    }

    return result;
  }

  async getMilestones(userId: string): Promise<MilestoneData[]> {
    const result = await pool.query(
      `SELECT * FROM user_milestones
       WHERE user_id = $1
       ORDER BY achieved_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      milestoneType: row.milestone_type,
      milestoneName: row.milestone_name,
      achievedAt: row.achieved_at,
      metadata: row.metadata || {},
    }));
  }

  async checkAndAwardMilestones(userId: string): Promise<MilestoneData[]> {
    const newMilestones: MilestoneData[] = [];

    // Get scan count
    const scanCount = await pool.query(
      'SELECT COUNT(*) as count FROM user_progress WHERE user_id = $1',
      [userId]
    );
    const count = parseInt(scanCount.rows[0].count, 10);

    // First scan milestone
    if (count >= 1) {
      const m = await this.awardMilestoneIfNew(userId, 'first_scan', MILESTONE_DEFINITIONS.first_scan.name);
      if (m) newMilestones.push(m);
    }

    // Five scans milestone
    if (count >= 5) {
      const m = await this.awardMilestoneIfNew(userId, 'five_scans', MILESTONE_DEFINITIONS.five_scans.name);
      if (m) newMilestones.push(m);
    }

    // Ten scans milestone
    if (count >= 10) {
      const m = await this.awardMilestoneIfNew(userId, 'ten_scans', MILESTONE_DEFINITIONS.ten_scans.name);
      if (m) newMilestones.push(m);
    }

    // Check for improvement milestones
    const compareResult = await this.compareWithFirst(userId);
    if (compareResult) {
      const improvements = Object.values(compareResult.changes);
      const maxImprovement = Math.max(...improvements, 0);

      if (maxImprovement >= 10) {
        const m = await this.awardMilestoneIfNew(userId, 'improvement_10', MILESTONE_DEFINITIONS.improvement_10.name);
        if (m) newMilestones.push(m);
      }

      if (maxImprovement >= 25) {
        const m = await this.awardMilestoneIfNew(userId, 'improvement_25', MILESTONE_DEFINITIONS.improvement_25.name);
        if (m) newMilestones.push(m);
      }
    }

    return newMilestones;
  }

  async createProgressSnapshot(
    userId: string,
    storeId: string,
    faceScanId: string,
    analysisResult: any
  ): Promise<ProgressSnapshot> {
    const scores = analysisResult.scores || {};

    // Check if snapshot already exists
    const existing = await pool.query(
      'SELECT id FROM user_progress WHERE user_id = $1 AND face_scan_id = $2',
      [userId, faceScanId]
    );

    if (existing.rows.length > 0) {
      throw createError('Progress snapshot already exists for this scan', 400);
    }

    // Get previous snapshot for change calculation
    const prevSnapshot = await pool.query(
      `SELECT * FROM user_progress
       WHERE user_id = $1 AND store_id = $2
       ORDER BY snapshot_date DESC LIMIT 1`,
      [userId, storeId]
    );

    let changes: Record<string, number> = {};
    let previousSnapshotId: string | null = null;

    if (prevSnapshot.rows.length > 0) {
      const prev = prevSnapshot.rows[0];
      previousSnapshotId = prev.id;
      changes = {
        skin_score: (scores.overall || 0) - (prev.skin_score || 0),
        acne_score: (scores.acne || 0) - (prev.acne_score || 0),
        wrinkle_score: (scores.wrinkles || 0) - (prev.wrinkle_score || 0),
        hydration_score: (scores.hydration || 0) - (prev.hydration_score || 0),
        pigmentation_score: (scores.pigmentation || 0) - (prev.pigmentation_score || 0),
        texture_score: (scores.texture || 0) - (prev.texture_score || 0),
        redness_score: (scores.redness || 0) - (prev.redness_score || 0),
        oiliness_score: (scores.oiliness || 0) - (prev.oiliness_score || 0),
      };
    }

    // Insert progress snapshot
    const result = await pool.query(
      `INSERT INTO user_progress (
        user_id, store_id, face_scan_id, snapshot_date,
        skin_score, acne_score, wrinkle_score, hydration_score,
        pigmentation_score, texture_score, redness_score, oiliness_score,
        skin_age_estimate, previous_snapshot_id, changes
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        userId,
        storeId,
        faceScanId,
        scores.overall || null,
        scores.acne || null,
        scores.wrinkles || null,
        scores.hydration || null,
        scores.pigmentation || null,
        scores.texture || null,
        scores.redness || null,
        scores.oiliness || null,
        analysisResult.skinAge || null,
        previousSnapshotId,
        JSON.stringify(changes),
      ]
    );

    // Check for new milestones
    await this.checkAndAwardMilestones(userId);

    return this.formatSnapshot(result.rows[0]);
  }

  async getSummary(userId: string): Promise<{
    totalScans: number;
    firstScanDate: string | null;
    latestScanDate: string | null;
    overallImprovement: Record<string, number>;
    milestoneCount: number;
    currentStreak: number;
  }> {
    // Get total scans and dates
    const stats = await pool.query(
      `SELECT
        COUNT(*) as total,
        MIN(snapshot_date) as first_date,
        MAX(snapshot_date) as latest_date
       FROM user_progress WHERE user_id = $1`,
      [userId]
    );

    // Get overall improvement
    const comparison = await this.compareWithFirst(userId);

    // Get milestone count
    const milestones = await pool.query(
      'SELECT COUNT(*) as count FROM user_milestones WHERE user_id = $1',
      [userId]
    );

    // Calculate current streak (days in a row with scans)
    const streakResult = await pool.query(
      `WITH dates AS (
        SELECT DISTINCT snapshot_date
        FROM user_progress
        WHERE user_id = $1
        ORDER BY snapshot_date DESC
      )
      SELECT COUNT(*) as streak
      FROM (
        SELECT snapshot_date,
               LAG(snapshot_date) OVER (ORDER BY snapshot_date DESC) as prev_date
        FROM dates
      ) t
      WHERE prev_date IS NULL OR snapshot_date = prev_date - INTERVAL '1 day'`,
      [userId]
    );

    return {
      totalScans: parseInt(stats.rows[0].total, 10),
      firstScanDate: stats.rows[0].first_date,
      latestScanDate: stats.rows[0].latest_date,
      overallImprovement: comparison?.changes || {},
      milestoneCount: parseInt(milestones.rows[0].count, 10),
      currentStreak: parseInt(streakResult.rows[0]?.streak || '0', 10),
    };
  }

  private async awardMilestoneIfNew(
    userId: string,
    milestoneType: string,
    milestoneName: string,
    metadata: Record<string, any> = {}
  ): Promise<MilestoneData | null> {
    try {
      const result = await pool.query(
        `INSERT INTO user_milestones (user_id, milestone_type, milestone_name, metadata)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, milestone_type) DO NOTHING
         RETURNING *`,
        [userId, milestoneType, milestoneName, JSON.stringify(metadata)]
      );

      if (result.rows.length > 0) {
        return {
          id: result.rows[0].id,
          milestoneType: result.rows[0].milestone_type,
          milestoneName: result.rows[0].milestone_name,
          achievedAt: result.rows[0].achieved_at,
          metadata: result.rows[0].metadata || {},
        };
      }

      return null;
    } catch (error) {
      console.error('[ProgressTracking] Error awarding milestone:', error);
      return null;
    }
  }

  private calculateChanges(before: ProgressSnapshot, after: ProgressSnapshot): Record<string, number> {
    const metrics = [
      'skinScore',
      'acneScore',
      'wrinkleScore',
      'hydrationScore',
      'pigmentationScore',
      'textureScore',
      'rednessScore',
      'oilinessScore',
    ];

    const changes: Record<string, number> = {};

    metrics.forEach((metric) => {
      const beforeVal = (before as any)[metric];
      const afterVal = (after as any)[metric];

      if (beforeVal !== null && afterVal !== null) {
        changes[metric] = afterVal - beforeVal;
      }
    });

    return changes;
  }

  private formatSnapshot(row: any): ProgressSnapshot {
    return {
      id: row.id,
      userId: row.user_id,
      faceScanId: row.face_scan_id,
      snapshotDate: row.snapshot_date,
      skinScore: row.skin_score,
      acneScore: row.acne_score,
      wrinkleScore: row.wrinkle_score,
      hydrationScore: row.hydration_score,
      pigmentationScore: row.pigmentation_score,
      textureScore: row.texture_score,
      rednessScore: row.redness_score,
      oilinessScore: row.oiliness_score,
      skinAgeEstimate: row.skin_age_estimate,
      changes: row.changes || {},
      imageUrl: row.image_url,
    };
  }
}

export default new ProgressTrackingService();
