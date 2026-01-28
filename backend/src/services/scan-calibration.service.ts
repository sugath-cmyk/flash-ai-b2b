/**
 * Scan Calibration Service
 *
 * Auto-learns thresholds from face scan data distribution.
 * Resets benchmarks periodically based on population statistics.
 *
 * Logic:
 * - Analyzes all scan results to understand score distributions
 * - Uses percentiles to set dynamic thresholds (not fixed values)
 * - Grade 0 (None): Bottom 20% of population
 * - Grade 1 (Mild): 20-40th percentile
 * - Grade 2 (Moderate): 40-60th percentile
 * - Grade 3 (Significant): 60-80th percentile
 * - Grade 4 (Severe): Top 20% of population
 */

import pool from '../config/database';

// Attributes we track and calibrate
const TRACKED_ATTRIBUTES = [
  'acne_score',
  'dark_circles_score',
  'pigmentation_score',
  'wrinkle_score',
  'redness_score',
  'texture_score',
  'hydration_score',
  'oiliness_score'
];

// Grade distribution targets (percentiles)
const GRADE_PERCENTILES = {
  none: 20,      // Bottom 20% = Grade 0
  mild: 40,      // 20-40% = Grade 1
  moderate: 60,  // 40-60% = Grade 2
  significant: 80, // 60-80% = Grade 3
  severe: 100    // Top 20% = Grade 4
};

// SAFETY: Absolute minimum thresholds to ensure severe issues are NEVER missed
// Even if population data suggests otherwise, scores above these = at least Grade 3
const ABSOLUTE_SEVERITY_THRESHOLDS: Record<string, number> = {
  'acne_score': 70,          // Severe acne should never be missed
  'dark_circles_score': 75,  // Significant dark circles
  'pigmentation_score': 70,  // Significant pigmentation
  'wrinkle_score': 65,       // Significant wrinkles
  'redness_score': 60,       // High redness (could indicate condition)
  'texture_score': 70,       // Poor texture
  'hydration_score': 30,     // Very dehydrated (inverted - low is bad)
  'oiliness_score': 80       // Very oily
};

// SAFETY: Absolute maximum for "none" grade - anything above this is at least mild
const ABSOLUTE_NONE_MAX: Record<string, number> = {
  'acne_score': 15,
  'dark_circles_score': 20,
  'pigmentation_score': 15,
  'wrinkle_score': 15,
  'redness_score': 15,
  'texture_score': 20,
  'hydration_score': 80,     // Inverted
  'oiliness_score': 20
};

export interface CalibrationData {
  attribute: string;
  sampleSize: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  percentiles: {
    p10: number;
    p20: number;
    p30: number;
    p40: number;
    p50: number;
    p60: number;
    p70: number;
    p80: number;
    p90: number;
  };
  thresholds: {
    none_max: number;      // Score <= this = Grade 0 (None)
    mild_max: number;      // Score <= this = Grade 1 (Mild)
    moderate_max: number;  // Score <= this = Grade 2 (Moderate)
    significant_max: number; // Score <= this = Grade 3 (Significant)
    // Above significant_max = Grade 4 (Severe)
  };
  lastCalibrated: Date;
}

export interface BenchmarkSnapshot {
  id: string;
  createdAt: Date;
  totalScans: number;
  calibrations: CalibrationData[];
  notes?: string;
}

class ScanCalibrationService {

  /**
   * Analyze all face scans and calculate current distribution
   */
  async analyzeDistribution(attribute: string): Promise<CalibrationData | null> {
    try {
      // Map attribute names to actual column names in face_analysis table
      const columnMap: Record<string, string> = {
        'acne_score': 'acne_score',
        'dark_circles_score': 'under_eye_darkness',
        'pigmentation_score': 'pigmentation_score',
        'wrinkle_score': 'wrinkle_score',
        'redness_score': 'redness_score',
        'texture_score': 'texture_score',
        'hydration_score': 'hydration_score',
        'oiliness_score': 'oiliness_score'
      };

      const columnName = columnMap[attribute] || attribute;

      // Get all scores for this attribute from face_analysis table
      const result = await pool.query(`
        SELECT ${columnName}::float as score
        FROM face_analysis
        WHERE ${columnName} IS NOT NULL
          AND ${columnName} >= 0
        ORDER BY score
      `);

      if (result.rows.length < 10) {
        console.log(`[Calibration] Not enough data for ${attribute}: ${result.rows.length} samples`);
        return null;
      }

      const scores = result.rows.map(r => r.score);
      const n = scores.length;

      // Calculate statistics
      const mean = scores.reduce((a, b) => a + b, 0) / n;
      const median = scores[Math.floor(n / 2)];
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);

      // Calculate percentiles
      const getPercentile = (p: number) => scores[Math.floor((p / 100) * (n - 1))];

      const percentiles = {
        p10: getPercentile(10),
        p20: getPercentile(20),
        p30: getPercentile(30),
        p40: getPercentile(40),
        p50: getPercentile(50),
        p60: getPercentile(60),
        p70: getPercentile(70),
        p80: getPercentile(80),
        p90: getPercentile(90),
      };

      // Calculate thresholds based on percentiles with SAFETY LIMITS
      // Ensure we never set thresholds that would miss severe issues
      const absoluteNoneMax = ABSOLUTE_NONE_MAX[attribute] ?? 20;
      const absoluteSeverityMin = ABSOLUTE_SEVERITY_THRESHOLDS[attribute] ?? 70;

      const thresholds = {
        // None threshold: minimum of percentile and absolute max
        none_max: Math.min(percentiles.p20, absoluteNoneMax),
        mild_max: Math.min(percentiles.p40, absoluteNoneMax + 20),
        moderate_max: Math.min(percentiles.p60, absoluteSeverityMin - 10),
        // Significant threshold: must be below absolute severity threshold
        significant_max: Math.min(percentiles.p80, absoluteSeverityMin),
      };

      console.log(`[Calibration] ${attribute}: Raw p20=${percentiles.p20}, Applied none_max=${thresholds.none_max} (absolute limit: ${absoluteNoneMax})`);
      console.log(`[Calibration] ${attribute}: Raw p80=${percentiles.p80}, Applied significant_max=${thresholds.significant_max} (severity floor: ${absoluteSeverityMin})`);

      return {
        attribute,
        sampleSize: n,
        mean: Math.round(mean * 100) / 100,
        median: Math.round(median * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        min: scores[0],
        max: scores[n - 1],
        percentiles,
        thresholds,
        lastCalibrated: new Date()
      };
    } catch (error) {
      console.error(`[Calibration] Error analyzing ${attribute}:`, error);
      return null;
    }
  }

  /**
   * Calibrate all attributes and save benchmarks
   */
  async calibrateAll(): Promise<BenchmarkSnapshot> {
    console.log('[Calibration] Starting full calibration...');

    const calibrations: CalibrationData[] = [];

    for (const attribute of TRACKED_ATTRIBUTES) {
      const data = await this.analyzeDistribution(attribute);
      if (data) {
        calibrations.push(data);
        console.log(`[Calibration] ${attribute}: mean=${data.mean}, median=${data.median}, samples=${data.sampleSize}`);
      }
    }

    // Get total scan count from face_analysis table
    const countResult = await pool.query('SELECT COUNT(*) FROM face_analysis');
    const totalScans = parseInt(countResult.rows[0].count);

    // Save snapshot to database
    const snapshot: BenchmarkSnapshot = {
      id: `cal_${Date.now()}`,
      createdAt: new Date(),
      totalScans,
      calibrations,
      notes: 'Auto-calibration from scan data'
    };

    await this.saveBenchmarkSnapshot(snapshot);

    console.log(`[Calibration] Complete. ${calibrations.length} attributes calibrated from ${totalScans} scans.`);

    return snapshot;
  }

  /**
   * Save benchmark snapshot to database
   */
  async saveBenchmarkSnapshot(snapshot: BenchmarkSnapshot): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO scan_benchmarks (id, created_at, total_scans, calibrations, notes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          calibrations = $4,
          notes = $5
      `, [
        snapshot.id,
        snapshot.createdAt,
        snapshot.totalScans,
        JSON.stringify(snapshot.calibrations),
        snapshot.notes
      ]);
    } catch (error: any) {
      // Table might not exist, create it
      if (error.code === '42P01') {
        await this.createBenchmarkTable();
        await this.saveBenchmarkSnapshot(snapshot);
      } else {
        console.error('[Calibration] Error saving snapshot:', error);
      }
    }
  }

  /**
   * Create benchmark table if not exists
   */
  async createBenchmarkTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scan_benchmarks (
        id VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        total_scans INTEGER,
        calibrations JSONB,
        notes TEXT
      )
    `);
    console.log('[Calibration] Created scan_benchmarks table');
  }

  /**
   * Get latest benchmark/calibration data
   */
  async getLatestBenchmark(): Promise<BenchmarkSnapshot | null> {
    try {
      const result = await pool.query(`
        SELECT * FROM scan_benchmarks
        ORDER BY created_at DESC
        LIMIT 1
      `);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        createdAt: row.created_at,
        totalScans: row.total_scans,
        calibrations: row.calibrations,
        notes: row.notes
      };
    } catch (error) {
      console.error('[Calibration] Error getting latest benchmark:', error);
      return null;
    }
  }

  /**
   * Get thresholds for a specific attribute from latest calibration
   */
  async getThresholds(attribute: string): Promise<CalibrationData['thresholds'] | null> {
    const benchmark = await this.getLatestBenchmark();
    if (!benchmark) return null;

    const calibration = benchmark.calibrations.find(c => c.attribute === attribute);
    return calibration?.thresholds || null;
  }

  /**
   * Convert raw score to grade (0-4) using dynamic thresholds
   * SAFETY: Always checks absolute severity thresholds to never miss severe issues
   */
  async scoreToGrade(attribute: string, score: number): Promise<number> {
    // SAFETY CHECK: If score exceeds absolute severity threshold, it's at least significant
    const absoluteSeverityMin = ABSOLUTE_SEVERITY_THRESHOLDS[attribute];
    if (absoluteSeverityMin && score >= absoluteSeverityMin) {
      // Score is above absolute severity threshold - at minimum Grade 3, possibly 4
      return score >= absoluteSeverityMin + 15 ? 4 : 3;
    }

    const thresholds = await this.getThresholds(attribute);

    if (!thresholds) {
      // Fallback to fixed thresholds if no calibration data
      if (score <= 20) return 0;
      if (score <= 40) return 1;
      if (score <= 60) return 2;
      if (score <= 80) return 3;
      return 4;
    }

    if (score <= thresholds.none_max) return 0;
    if (score <= thresholds.mild_max) return 1;
    if (score <= thresholds.moderate_max) return 2;
    if (score <= thresholds.significant_max) return 3;
    return 4;
  }

  /**
   * Reset benchmarks - recalibrate based on current data
   */
  async resetBenchmarks(): Promise<BenchmarkSnapshot> {
    console.log('[Calibration] Resetting benchmarks...');
    return this.calibrateAll();
  }

  /**
   * Get calibration summary for dashboard
   */
  async getCalibrationSummary(): Promise<{
    lastCalibration: Date | null;
    totalScans: number;
    attributes: Array<{
      name: string;
      sampleSize: number;
      mean: number;
      distribution: string;
      thresholds: string;
    }>;
    needsRecalibration: boolean;
    recommendation: string;
  }> {
    const benchmark = await this.getLatestBenchmark();
    const countResult = await pool.query('SELECT COUNT(*) FROM face_analysis');
    const currentScans = parseInt(countResult.rows[0].count);

    if (!benchmark) {
      return {
        lastCalibration: null,
        totalScans: currentScans,
        attributes: [],
        needsRecalibration: true,
        recommendation: 'No calibration data. Run initial calibration.'
      };
    }

    const scansAddedSince = currentScans - benchmark.totalScans;
    const needsRecalibration = scansAddedSince > 50 || scansAddedSince > benchmark.totalScans * 0.2;

    return {
      lastCalibration: benchmark.createdAt,
      totalScans: currentScans,
      attributes: benchmark.calibrations.map(c => ({
        name: c.attribute,
        sampleSize: c.sampleSize,
        mean: c.mean,
        distribution: `min=${c.min}, max=${c.max}, stdDev=${c.stdDev}`,
        thresholds: `0:${c.thresholds.none_max} | 1:${c.thresholds.mild_max} | 2:${c.thresholds.moderate_max} | 3:${c.thresholds.significant_max}`
      })),
      needsRecalibration,
      recommendation: needsRecalibration
        ? `${scansAddedSince} new scans since last calibration. Consider recalibrating.`
        : 'Calibration is current.'
    };
  }

  /**
   * Get grade distribution from current data
   * Shows how many scans fall into each grade for each attribute
   */
  async getGradeDistribution(): Promise<Record<string, Record<number, number>>> {
    const benchmark = await this.getLatestBenchmark();
    if (!benchmark) return {};

    // Map attribute names to actual column names
    const columnMap: Record<string, string> = {
      'acne_score': 'acne_score',
      'dark_circles_score': 'under_eye_darkness',
      'pigmentation_score': 'pigmentation_score',
      'wrinkle_score': 'wrinkle_score',
      'redness_score': 'redness_score',
      'texture_score': 'texture_score',
      'hydration_score': 'hydration_score',
      'oiliness_score': 'oiliness_score'
    };

    const distribution: Record<string, Record<number, number>> = {};

    for (const calibration of benchmark.calibrations) {
      const attr = calibration.attribute;
      const columnName = columnMap[attr] || attr;
      const thresholds = calibration.thresholds;

      try {
        const result = await pool.query(`
          SELECT
            SUM(CASE WHEN ${columnName}::float <= $1 THEN 1 ELSE 0 END) as grade_0,
            SUM(CASE WHEN ${columnName}::float > $1 AND ${columnName}::float <= $2 THEN 1 ELSE 0 END) as grade_1,
            SUM(CASE WHEN ${columnName}::float > $2 AND ${columnName}::float <= $3 THEN 1 ELSE 0 END) as grade_2,
            SUM(CASE WHEN ${columnName}::float > $3 AND ${columnName}::float <= $4 THEN 1 ELSE 0 END) as grade_3,
            SUM(CASE WHEN ${columnName}::float > $4 THEN 1 ELSE 0 END) as grade_4
          FROM face_analysis
          WHERE ${columnName} IS NOT NULL
        `, [thresholds.none_max, thresholds.mild_max, thresholds.moderate_max, thresholds.significant_max]);

        distribution[attr] = {
          0: parseInt(result.rows[0].grade_0) || 0,
          1: parseInt(result.rows[0].grade_1) || 0,
          2: parseInt(result.rows[0].grade_2) || 0,
          3: parseInt(result.rows[0].grade_3) || 0,
          4: parseInt(result.rows[0].grade_4) || 0
        };
      } catch (error) {
        console.error(`[Calibration] Error getting distribution for ${attr}:`, error);
      }
    }

    return distribution;
  }
}

export const scanCalibrationService = new ScanCalibrationService();
export default scanCalibrationService;
