import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';

// Use existing store for demo/test
const DEMO_FALLBACK_STORE_UUID = '62130715-ff42-4160-934e-c663fc1e7872';

interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  goalType: string;
  targetMetric: string;
  defaultImprovementPercent: number;
  typicalDurationWeeks: number;
  recommendedProducts: string[];
  icon: string;
  displayOrder: number;
}

interface UserGoal {
  id: string;
  userId: string;
  storeId: string;
  templateId: string | null;
  goalType: string;
  goalName: string;
  targetMetric: string;
  baselineValue: number | null;
  currentValue: number | null;
  targetValue: number | null;
  startDate: string;
  targetDate: string | null;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface CreateGoalData {
  userId: string;
  storeId: string;
  templateId?: string;
  goalType?: string;
  goalName?: string;
  targetMetric?: string;
  targetValue?: number;
  targetWeeks?: number;
}

export class GoalService {
  async getTemplates(): Promise<GoalTemplate[]> {
    const result = await pool.query(
      `SELECT * FROM goal_templates WHERE is_active = true ORDER BY display_order ASC`
    );

    return result.rows.map(this.formatTemplate);
  }

  async getTemplateById(templateId: string): Promise<GoalTemplate | null> {
    const result = await pool.query(
      `SELECT * FROM goal_templates WHERE id = $1 AND is_active = true`,
      [templateId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatTemplate(result.rows[0]);
  }

  async createGoal(data: CreateGoalData): Promise<UserGoal> {
    const { userId, storeId: rawStoreId, templateId, goalType, goalName, targetMetric, targetValue, targetWeeks } = data;

    // Handle demo stores
    const isDemoStore = rawStoreId === 'demo-store' || rawStoreId === 'demo' || rawStoreId === 'test';
    const storeId = isDemoStore ? DEMO_FALLBACK_STORE_UUID : rawStoreId;

    let template: GoalTemplate | null = null;
    let finalGoalType = goalType;
    let finalGoalName = goalName;
    let finalTargetMetric = targetMetric;
    let finalTargetValue = targetValue;
    let finalTargetWeeks = targetWeeks;

    // If template provided, use its defaults
    if (templateId) {
      template = await this.getTemplateById(templateId);
      if (!template) {
        throw createError('Goal template not found', 404);
      }

      finalGoalType = template.goalType;
      finalGoalName = finalGoalName || template.name;
      finalTargetMetric = template.targetMetric;
      finalTargetWeeks = finalTargetWeeks || template.typicalDurationWeeks;
    }

    if (!finalGoalType || !finalTargetMetric) {
      throw createError('Goal type and target metric are required', 400);
    }

    // Get baseline value from latest scan
    const baselineResult = await pool.query(
      `SELECT ${this.getMetricColumn(finalTargetMetric)} as value
       FROM user_progress
       WHERE user_id = $1
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [userId]
    );

    const baselineValue = baselineResult.rows[0]?.value || null;

    // Calculate target value if not provided
    if (!finalTargetValue && baselineValue && template) {
      // For metrics where lower is better (acne, wrinkles, redness, oiliness, pigmentation)
      const lowerIsBetter = ['acne_score', 'wrinkle_score', 'redness_score', 'oiliness_score', 'pigmentation_score'];
      if (lowerIsBetter.includes(finalTargetMetric)) {
        finalTargetValue = Math.max(0, baselineValue - (baselineValue * template.defaultImprovementPercent / 100));
      } else {
        // For metrics where higher is better (hydration, texture, skin_score)
        finalTargetValue = Math.min(100, baselineValue + (baselineValue * template.defaultImprovementPercent / 100));
      }
    }

    // Calculate target date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (finalTargetWeeks || 8) * 7);

    const result = await pool.query(
      `INSERT INTO user_goals (
        user_id, store_id, template_id, goal_type, goal_name,
        target_metric, baseline_value, current_value, target_value,
        start_date, target_date, status, progress_percent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, CURRENT_DATE, $9, 'active', 0)
      RETURNING *`,
      [
        userId,
        storeId,
        templateId || null,
        finalGoalType,
        finalGoalName || `Improve ${finalTargetMetric.replace('_score', '')}`,
        finalTargetMetric,
        baselineValue,
        finalTargetValue,
        targetDate.toISOString().split('T')[0],
      ]
    );

    return this.formatGoal(result.rows[0]);
  }

  async getUserGoals(userId: string, status?: string): Promise<UserGoal[]> {
    let query = `SELECT * FROM user_goals WHERE user_id = $1`;
    const params: any[] = [userId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows.map(this.formatGoal);
  }

  async getGoalById(goalId: string, userId: string): Promise<UserGoal | null> {
    const result = await pool.query(
      `SELECT * FROM user_goals WHERE id = $1 AND user_id = $2`,
      [goalId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatGoal(result.rows[0]);
  }

  async updateGoalProgress(userId: string, scanAnalysis: any): Promise<UserGoal[]> {
    // Get all active goals for the user
    const activeGoals = await pool.query(
      `SELECT * FROM user_goals WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const updatedGoals: UserGoal[] = [];
    const scores = scanAnalysis.scores || {};

    for (const goal of activeGoals.rows) {
      const metricColumn = goal.target_metric;
      const currentValue = scores[metricColumn.replace('_score', '')] || scores[metricColumn];

      if (currentValue === undefined) continue;

      // Calculate progress
      let progressPercent = 0;
      if (goal.baseline_value !== null && goal.target_value !== null) {
        const totalChange = Math.abs(goal.target_value - goal.baseline_value);
        const currentChange = Math.abs(currentValue - goal.baseline_value);

        if (totalChange > 0) {
          // Check if moving in right direction
          const lowerIsBetter = ['acne_score', 'wrinkle_score', 'redness_score', 'oiliness_score', 'pigmentation_score'];
          const isImproving = lowerIsBetter.includes(metricColumn)
            ? currentValue < goal.baseline_value
            : currentValue > goal.baseline_value;

          if (isImproving) {
            progressPercent = Math.min(100, Math.round((currentChange / totalChange) * 100));
          }
        }
      }

      // Check if goal completed
      let newStatus = goal.status;
      let completedAt = null;
      if (progressPercent >= 100) {
        newStatus = 'completed';
        completedAt = new Date().toISOString();
      }

      // Update goal
      const updateResult = await pool.query(
        `UPDATE user_goals
         SET current_value = $1, progress_percent = $2, status = $3,
             completed_at = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [currentValue, progressPercent, newStatus, completedAt, goal.id]
      );

      updatedGoals.push(this.formatGoal(updateResult.rows[0]));
    }

    return updatedGoals;
  }

  async updateGoalStatus(goalId: string, userId: string, status: 'active' | 'paused' | 'abandoned'): Promise<UserGoal> {
    const result = await pool.query(
      `UPDATE user_goals
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, goalId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('Goal not found', 404);
    }

    return this.formatGoal(result.rows[0]);
  }

  async deleteGoal(goalId: string, userId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM user_goals WHERE id = $1 AND user_id = $2 RETURNING id`,
      [goalId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('Goal not found', 404);
    }
  }

  async getGoalSuggestions(userId: string): Promise<GoalTemplate[]> {
    // Get user's latest scan to suggest relevant goals
    const latestScan = await pool.query(
      `SELECT * FROM user_progress
       WHERE user_id = $1
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [userId]
    );

    const templates = await this.getTemplates();

    if (latestScan.rows.length === 0) {
      // No scans yet, return all templates
      return templates;
    }

    const scan = latestScan.rows[0];

    // Score templates based on user's needs
    const scored = templates.map(template => {
      let priority = 0;
      const metric = template.targetMetric;
      const value = scan[metric];

      if (value !== null) {
        // Lower scores need more attention for these metrics
        const lowerIsBetter = ['acne_score', 'wrinkle_score', 'redness_score', 'oiliness_score', 'pigmentation_score'];

        if (lowerIsBetter.includes(metric)) {
          // High values = needs improvement
          priority = value;
        } else {
          // Low values = needs improvement
          priority = 100 - value;
        }
      }

      return { template, priority };
    });

    // Sort by priority (highest first) and return templates
    return scored
      .sort((a, b) => b.priority - a.priority)
      .map(s => s.template);
  }

  private getMetricColumn(metric: string): string {
    const columnMap: Record<string, string> = {
      skin_score: 'skin_score',
      acne_score: 'acne_score',
      wrinkle_score: 'wrinkle_score',
      hydration_score: 'hydration_score',
      pigmentation_score: 'pigmentation_score',
      texture_score: 'texture_score',
      redness_score: 'redness_score',
      oiliness_score: 'oiliness_score',
    };

    return columnMap[metric] || metric;
  }

  private formatTemplate(row: any): GoalTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      goalType: row.goal_type,
      targetMetric: row.target_metric,
      defaultImprovementPercent: row.default_improvement_percent,
      typicalDurationWeeks: row.typical_duration_weeks,
      recommendedProducts: row.recommended_products || [],
      icon: row.icon,
      displayOrder: row.display_order,
    };
  }

  private formatGoal(row: any): UserGoal {
    return {
      id: row.id,
      userId: row.user_id,
      storeId: row.store_id,
      templateId: row.template_id,
      goalType: row.goal_type,
      goalName: row.goal_name,
      targetMetric: row.target_metric,
      baselineValue: row.baseline_value,
      currentValue: row.current_value,
      targetValue: row.target_value,
      startDate: row.start_date,
      targetDate: row.target_date,
      status: row.status,
      progressPercent: row.progress_percent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  /**
   * Auto-create goals based on face scan analysis
   * Creates up to 3 priority goals based on detected concerns
   */
  async createGoalsFromScan(userId: string, storeId: string): Promise<UserGoal[]> {
    // Get user's latest face scan analysis
    const scanResult = await pool.query(
      `SELECT fa.* FROM face_analysis fa
       JOIN face_scans fs ON fa.face_scan_id = fs.id
       JOIN widget_users wu ON (fs.visitor_id = wu.visitor_id OR fs.user_id = $1::text)
       WHERE wu.id = $1
       ORDER BY fa.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (scanResult.rows.length === 0) {
      throw createError('No face scan found. Please complete a face scan first.', 404);
    }

    const analysis = scanResult.rows[0];

    // Map concerns to templates
    const concernToTemplate: Record<string, { metric: string; threshold: number }> = {
      'clear_acne': { metric: 'acne_score', threshold: 30 },
      'reduce_wrinkles': { metric: 'wrinkle_score', threshold: 30 },
      'improve_hydration': { metric: 'hydration_score', threshold: 70 },
      'even_tone': { metric: 'pigmentation_score', threshold: 30 },
      'smooth_texture': { metric: 'texture_score', threshold: 70 },
      'reduce_redness': { metric: 'redness_score', threshold: 30 },
      'control_oil': { metric: 'oiliness_score', threshold: 30 },
    };

    // Identify concerns that need attention
    const priorities: { type: string; severity: number }[] = [];

    // Lower is better for these
    if ((analysis.acne_score || 0) > 30) {
      priorities.push({ type: 'clear_acne', severity: analysis.acne_score });
    }
    if ((analysis.wrinkle_score || 0) > 30) {
      priorities.push({ type: 'reduce_wrinkles', severity: analysis.wrinkle_score });
    }
    if ((analysis.pigmentation_score || 0) > 30) {
      priorities.push({ type: 'even_tone', severity: analysis.pigmentation_score });
    }
    if ((analysis.redness_score || 0) > 30) {
      priorities.push({ type: 'reduce_redness', severity: analysis.redness_score });
    }
    if ((analysis.oiliness_score || 0) > 50) {
      priorities.push({ type: 'control_oil', severity: analysis.oiliness_score });
    }

    // Higher is better for these - low values = concern
    if ((analysis.hydration_score || 100) < 60) {
      priorities.push({ type: 'improve_hydration', severity: 100 - (analysis.hydration_score || 0) });
    }
    if ((analysis.texture_score || 100) < 60) {
      priorities.push({ type: 'smooth_texture', severity: 100 - (analysis.texture_score || 0) });
    }

    // Sort by severity (most severe first)
    priorities.sort((a, b) => b.severity - a.severity);

    // Get existing active goals for this user
    const existingGoals = await pool.query(
      `SELECT goal_type FROM user_goals WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    const existingTypes = new Set(existingGoals.rows.map((r: any) => r.goal_type));

    // Create up to 3 goals (skip if user already has that goal)
    const createdGoals: UserGoal[] = [];
    const templates = await this.getTemplates();

    for (const priority of priorities.slice(0, 3)) {
      if (existingTypes.has(priority.type)) continue;

      const template = templates.find(t => t.goalType === priority.type);
      if (!template) continue;

      try {
        const goal = await this.createGoal({
          userId,
          storeId,
          templateId: template.id,
        });
        createdGoals.push(goal);
        existingTypes.add(priority.type);
      } catch (error) {
        console.error(`Error creating goal ${priority.type}:`, error);
      }
    }

    return createdGoals;
  }

  /**
   * Get monthly progress breakdown for a goal
   */
  async getGoalMonthlyProgress(goalId: string, userId: string): Promise<any[]> {
    const goal = await this.getGoalById(goalId, userId);
    if (!goal) {
      throw createError('Goal not found', 404);
    }

    const metricColumn = this.getMetricColumn(goal.targetMetric);

    // Get monthly snapshots since goal creation
    const result = await pool.query(
      `SELECT
        DATE_TRUNC('month', snapshot_date) as month,
        AVG(${metricColumn}) as avg_value,
        MIN(${metricColumn}) as min_value,
        MAX(${metricColumn}) as max_value,
        COUNT(*) as scan_count
       FROM user_progress
       WHERE user_id = $1 AND snapshot_date >= $2
       GROUP BY DATE_TRUNC('month', snapshot_date)
       ORDER BY month ASC`,
      [userId, goal.startDate]
    );

    return result.rows.map((row: any) => ({
      month: row.month,
      avgValue: Math.round(row.avg_value),
      minValue: row.min_value,
      maxValue: row.max_value,
      scanCount: parseInt(row.scan_count),
    }));
  }
}

export default new GoalService();
