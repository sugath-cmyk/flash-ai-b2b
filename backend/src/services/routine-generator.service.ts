import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';

// Use existing store for demo/test
const DEMO_FALLBACK_STORE_UUID = '62130715-ff42-4160-934e-c663fc1e7872';

// Standard skincare routine steps
const AM_ROUTINE_TEMPLATE = [
  { stepType: 'cleanser', name: 'Gentle Cleanser', instructions: 'Massage onto damp skin for 30-60 seconds, then rinse', durationSeconds: 60, frequency: 'daily' },
  { stepType: 'toner', name: 'Hydrating Toner', instructions: 'Apply to cotton pad and gently pat onto face', durationSeconds: 30, frequency: 'daily', isOptional: true },
  { stepType: 'serum', name: 'Treatment Serum', instructions: 'Apply 2-3 drops and gently press into skin', durationSeconds: 30, frequency: 'daily' },
  { stepType: 'eye_cream', name: 'Eye Cream', instructions: 'Dab gently around eye area with ring finger', durationSeconds: 20, frequency: 'daily', isOptional: true },
  { stepType: 'moisturizer', name: 'Moisturizer', instructions: 'Apply a pea-sized amount and massage upward', durationSeconds: 30, frequency: 'daily' },
  { stepType: 'sunscreen', name: 'Sunscreen SPF 30+', instructions: 'Apply generously 15 min before sun exposure', durationSeconds: 30, frequency: 'daily' },
];

const PM_ROUTINE_TEMPLATE = [
  { stepType: 'makeup_remover', name: 'Makeup Remover/Oil Cleanser', instructions: 'Massage onto dry skin to dissolve makeup', durationSeconds: 60, frequency: 'daily', isOptional: true },
  { stepType: 'cleanser', name: 'Gentle Cleanser', instructions: 'Massage onto damp skin for 30-60 seconds, then rinse', durationSeconds: 60, frequency: 'daily' },
  { stepType: 'exfoliant', name: 'Exfoliating Treatment', instructions: 'Apply thin layer avoiding eye area', durationSeconds: 30, frequency: '2x_week', isOptional: true },
  { stepType: 'toner', name: 'Treatment Toner', instructions: 'Apply to cotton pad and gently pat onto face', durationSeconds: 30, frequency: 'daily', isOptional: true },
  { stepType: 'serum', name: 'Night Serum', instructions: 'Apply 2-3 drops and gently press into skin', durationSeconds: 30, frequency: 'daily' },
  { stepType: 'treatment', name: 'Spot Treatment', instructions: 'Apply directly to problem areas', durationSeconds: 20, frequency: 'daily', isOptional: true },
  { stepType: 'eye_cream', name: 'Night Eye Cream', instructions: 'Dab gently around eye area with ring finger', durationSeconds: 20, frequency: 'daily', isOptional: true },
  { stepType: 'moisturizer', name: 'Night Cream', instructions: 'Apply generous amount and let absorb', durationSeconds: 30, frequency: 'daily' },
  { stepType: 'face_oil', name: 'Face Oil', instructions: 'Warm 2-3 drops between palms and press into skin', durationSeconds: 20, frequency: 'daily', isOptional: true },
];

// Goal-specific product recommendations
const GOAL_PRODUCT_RECOMMENDATIONS: Record<string, Record<string, string[]>> = {
  clear_acne: {
    cleanser: ['salicylic acid cleanser', 'benzoyl peroxide cleanser', 'gentle foaming cleanser'],
    serum: ['niacinamide serum', 'salicylic acid serum', 'zinc serum'],
    treatment: ['benzoyl peroxide spot treatment', 'tea tree oil', 'sulfur treatment'],
    moisturizer: ['oil-free moisturizer', 'gel moisturizer', 'lightweight hydrator'],
  },
  reduce_wrinkles: {
    serum: ['retinol serum', 'vitamin c serum', 'peptide serum'],
    eye_cream: ['retinol eye cream', 'peptide eye cream', 'caffeine eye cream'],
    moisturizer: ['anti-aging moisturizer', 'peptide cream', 'hyaluronic acid cream'],
    treatment: ['retinoid treatment', 'glycolic acid treatment'],
  },
  improve_hydration: {
    toner: ['hydrating toner', 'essence', 'hyaluronic acid toner'],
    serum: ['hyaluronic acid serum', 'ceramide serum', 'squalane serum'],
    moisturizer: ['rich moisturizer', 'barrier repair cream', 'ceramide cream'],
    face_oil: ['rosehip oil', 'marula oil', 'squalane oil'],
  },
  even_tone: {
    serum: ['vitamin c serum', 'niacinamide serum', 'alpha arbutin serum'],
    treatment: ['AHA treatment', 'kojic acid', 'azelaic acid'],
    sunscreen: ['SPF 50 sunscreen', 'tinted sunscreen', 'mineral sunscreen'],
  },
  smooth_texture: {
    cleanser: ['AHA cleanser', 'enzyme cleanser', 'exfoliating cleanser'],
    exfoliant: ['glycolic acid peel', 'lactic acid treatment', 'PHA toner'],
    serum: ['niacinamide serum', 'retinol serum', 'BHA serum'],
  },
  reduce_redness: {
    cleanser: ['gentle cream cleanser', 'micellar water', 'soothing cleanser'],
    serum: ['centella serum', 'green tea serum', 'azelaic acid serum'],
    moisturizer: ['calming moisturizer', 'barrier cream', 'cica cream'],
  },
  control_oil: {
    cleanser: ['clay cleanser', 'gel cleanser', 'salicylic acid cleanser'],
    toner: ['witch hazel toner', 'niacinamide toner', 'BHA toner'],
    serum: ['niacinamide serum', 'salicylic acid serum', 'zinc serum'],
    moisturizer: ['gel moisturizer', 'oil-free lotion', 'mattifying moisturizer'],
  },
};

interface RoutineStep {
  id: string;
  routineId: string;
  stepOrder: number;
  stepType: string;
  productId: string | null;
  customProductName: string | null;
  customProductBrand: string | null;
  instructions: string;
  durationSeconds: number;
  isOptional: boolean;
  frequency: string;
}

interface Routine {
  id: string;
  userId: string;
  storeId: string;
  name: string;
  routineType: 'am' | 'pm' | 'weekly';
  isActive: boolean;
  generatedFromGoals: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  steps: RoutineStep[];
}

interface RoutineLog {
  id: string;
  userId: string;
  routineId: string;
  completedAt: string;
  stepsCompleted: number[];
  totalSteps: number;
  completionPercent: number;
  skinFeeling: string | null;
  notes: string | null;
}

interface CreateRoutineData {
  userId: string;
  storeId: string;
  name?: string;
  routineType: 'am' | 'pm' | 'weekly';
  notes?: string;
}

export class RoutineGeneratorService {
  async generateRoutines(userId: string, storeId: string): Promise<{ am: Routine; pm: Routine }> {
    // Handle demo stores
    const isDemoStore = storeId === 'demo-store' || storeId === 'demo' || storeId === 'test';
    const actualStoreId = isDemoStore ? DEMO_FALLBACK_STORE_UUID : storeId;

    // Get user's active goals
    const goalsResult = await pool.query(
      `SELECT * FROM user_goals WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const goals = goalsResult.rows;
    const goalTypes = goals.map((g: any) => g.goal_type);

    // Generate AM routine
    const amRoutine = await this.createRoutineWithSteps(
      userId,
      actualStoreId,
      'am',
      'Morning Routine',
      AM_ROUTINE_TEMPLATE,
      goalTypes,
      true
    );

    // Generate PM routine
    const pmRoutine = await this.createRoutineWithSteps(
      userId,
      actualStoreId,
      'pm',
      'Evening Routine',
      PM_ROUTINE_TEMPLATE,
      goalTypes,
      true
    );

    return { am: amRoutine, pm: pmRoutine };
  }

  async createRoutine(data: CreateRoutineData): Promise<Routine> {
    const { userId, storeId: rawStoreId, name, routineType, notes } = data;

    const isDemoStore = rawStoreId === 'demo-store' || rawStoreId === 'demo' || rawStoreId === 'test';
    const storeId = isDemoStore ? DEMO_FALLBACK_STORE_UUID : rawStoreId;

    const result = await pool.query(
      `INSERT INTO user_routines (user_id, store_id, name, routine_type, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, storeId, name || `My ${routineType.toUpperCase()} Routine`, routineType, notes || null]
    );

    return {
      ...this.formatRoutine(result.rows[0]),
      steps: [],
    };
  }

  async getUserRoutines(userId: string): Promise<Routine[]> {
    const routinesResult = await pool.query(
      `SELECT * FROM user_routines WHERE user_id = $1 ORDER BY routine_type ASC, created_at DESC`,
      [userId]
    );

    const routines: Routine[] = [];

    for (const row of routinesResult.rows) {
      const stepsResult = await pool.query(
        `SELECT * FROM routine_steps WHERE routine_id = $1 ORDER BY step_order ASC`,
        [row.id]
      );

      routines.push({
        ...this.formatRoutine(row),
        steps: stepsResult.rows.map(this.formatStep),
      });
    }

    return routines;
  }

  async getRoutineById(routineId: string, userId: string): Promise<Routine | null> {
    const routineResult = await pool.query(
      `SELECT * FROM user_routines WHERE id = $1 AND user_id = $2`,
      [routineId, userId]
    );

    if (routineResult.rows.length === 0) {
      return null;
    }

    const stepsResult = await pool.query(
      `SELECT * FROM routine_steps WHERE routine_id = $1 ORDER BY step_order ASC`,
      [routineId]
    );

    return {
      ...this.formatRoutine(routineResult.rows[0]),
      steps: stepsResult.rows.map(this.formatStep),
    };
  }

  async addStep(
    routineId: string,
    userId: string,
    stepData: {
      stepType: string;
      productId?: string;
      customProductName?: string;
      customProductBrand?: string;
      instructions?: string;
      durationSeconds?: number;
      isOptional?: boolean;
      frequency?: string;
    }
  ): Promise<RoutineStep> {
    // Verify routine belongs to user
    const routineCheck = await pool.query(
      `SELECT id FROM user_routines WHERE id = $1 AND user_id = $2`,
      [routineId, userId]
    );

    if (routineCheck.rows.length === 0) {
      throw createError('Routine not found', 404);
    }

    // Get next step order
    const orderResult = await pool.query(
      `SELECT COALESCE(MAX(step_order), 0) + 1 as next_order FROM routine_steps WHERE routine_id = $1`,
      [routineId]
    );

    const stepOrder = orderResult.rows[0].next_order;

    const result = await pool.query(
      `INSERT INTO routine_steps (
        routine_id, step_order, step_type, product_id,
        custom_product_name, custom_product_brand, instructions,
        duration_seconds, is_optional, frequency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        routineId,
        stepOrder,
        stepData.stepType,
        stepData.productId || null,
        stepData.customProductName || null,
        stepData.customProductBrand || null,
        stepData.instructions || '',
        stepData.durationSeconds || 30,
        stepData.isOptional || false,
        stepData.frequency || 'daily',
      ]
    );

    return this.formatStep(result.rows[0]);
  }

  async updateStep(stepId: string, userId: string, updates: Partial<{
    stepOrder: number;
    productId: string;
    customProductName: string;
    customProductBrand: string;
    instructions: string;
    durationSeconds: number;
    isOptional: boolean;
    frequency: string;
  }>): Promise<RoutineStep> {
    // Verify step belongs to user's routine
    const stepCheck = await pool.query(
      `SELECT rs.* FROM routine_steps rs
       JOIN user_routines ur ON rs.routine_id = ur.id
       WHERE rs.id = $1 AND ur.user_id = $2`,
      [stepId, userId]
    );

    if (stepCheck.rows.length === 0) {
      throw createError('Step not found', 404);
    }

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      stepOrder: 'step_order',
      productId: 'product_id',
      customProductName: 'custom_product_name',
      customProductBrand: 'custom_product_brand',
      instructions: 'instructions',
      durationSeconds: 'duration_seconds',
      isOptional: 'is_optional',
      frequency: 'frequency',
    };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && fieldMap[key]) {
        setFields.push(`${fieldMap[key]} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (setFields.length === 0) {
      return this.formatStep(stepCheck.rows[0]);
    }

    values.push(stepId);

    const result = await pool.query(
      `UPDATE routine_steps SET ${setFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return this.formatStep(result.rows[0]);
  }

  async deleteStep(stepId: string, userId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM routine_steps rs
       USING user_routines ur
       WHERE rs.routine_id = ur.id AND rs.id = $1 AND ur.user_id = $2
       RETURNING rs.id`,
      [stepId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('Step not found', 404);
    }
  }

  async logCompletion(
    userId: string,
    routineId: string,
    data: {
      stepsCompleted: number[];
      skinFeeling?: 'great' | 'good' | 'okay' | 'irritated' | 'bad';
      notes?: string;
    }
  ): Promise<RoutineLog> {
    // Verify routine belongs to user
    const routine = await this.getRoutineById(routineId, userId);
    if (!routine) {
      throw createError('Routine not found', 404);
    }

    const totalSteps = routine.steps.filter(s => !s.isOptional).length;
    const completedRequired = data.stepsCompleted.filter(stepOrder =>
      routine.steps.find(s => s.stepOrder === stepOrder && !s.isOptional)
    ).length;

    const completionPercent = totalSteps > 0 ? Math.round((completedRequired / totalSteps) * 100) : 100;

    const result = await pool.query(
      `INSERT INTO routine_logs (
        user_id, routine_id, steps_completed, total_steps,
        completion_percent, skin_feeling, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        userId,
        routineId,
        data.stepsCompleted,
        totalSteps,
        completionPercent,
        data.skinFeeling || null,
        data.notes || null,
      ]
    );

    return this.formatLog(result.rows[0]);
  }

  async getRoutineLogs(userId: string, routineId?: string, limit: number = 30): Promise<RoutineLog[]> {
    let query = `SELECT * FROM routine_logs WHERE user_id = $1`;
    const params: any[] = [userId];

    if (routineId) {
      query += ` AND routine_id = $2`;
      params.push(routineId);
    }

    query += ` ORDER BY completed_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows.map(this.formatLog);
  }

  async getRoutineStats(userId: string): Promise<{
    totalRoutines: number;
    completionsThisWeek: number;
    currentStreak: number;
    averageCompletion: number;
  }> {
    const routineCount = await pool.query(
      `SELECT COUNT(*) as count FROM user_routines WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const weekCompletions = await pool.query(
      `SELECT COUNT(*) as count FROM routine_logs
       WHERE user_id = $1 AND completed_at >= $2`,
      [userId, weekStart]
    );

    const avgCompletion = await pool.query(
      `SELECT COALESCE(AVG(completion_percent), 0) as avg FROM routine_logs WHERE user_id = $1`,
      [userId]
    );

    // Calculate streak (consecutive days with completions)
    const streakResult = await pool.query(
      `WITH daily_completions AS (
        SELECT DISTINCT DATE(completed_at) as completion_date
        FROM routine_logs
        WHERE user_id = $1
        ORDER BY completion_date DESC
      )
      SELECT COUNT(*) as streak
      FROM (
        SELECT completion_date,
               LAG(completion_date) OVER (ORDER BY completion_date DESC) as prev_date
        FROM daily_completions
      ) t
      WHERE prev_date IS NULL OR completion_date = prev_date - INTERVAL '1 day'`,
      [userId]
    );

    return {
      totalRoutines: parseInt(routineCount.rows[0].count),
      completionsThisWeek: parseInt(weekCompletions.rows[0].count),
      currentStreak: parseInt(streakResult.rows[0]?.streak || '0'),
      averageCompletion: Math.round(parseFloat(avgCompletion.rows[0].avg)),
    };
  }

  async deleteRoutine(routineId: string, userId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM user_routines WHERE id = $1 AND user_id = $2 RETURNING id`,
      [routineId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('Routine not found', 404);
    }
  }

  private async createRoutineWithSteps(
    userId: string,
    storeId: string,
    routineType: 'am' | 'pm',
    name: string,
    template: any[],
    goalTypes: string[],
    generatedFromGoals: boolean
  ): Promise<Routine> {
    // Check if routine already exists
    const existingRoutine = await pool.query(
      `SELECT id FROM user_routines
       WHERE user_id = $1 AND routine_type = $2 AND is_active = true`,
      [userId, routineType]
    );

    // Deactivate existing routine if regenerating
    if (existingRoutine.rows.length > 0) {
      await pool.query(
        `UPDATE user_routines SET is_active = false WHERE id = $1`,
        [existingRoutine.rows[0].id]
      );
    }

    // Create new routine
    const routineResult = await pool.query(
      `INSERT INTO user_routines (user_id, store_id, name, routine_type, generated_from_goals)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, storeId, name, routineType, generatedFromGoals]
    );

    const routine = routineResult.rows[0];

    // Create steps with goal-specific recommendations
    const steps: RoutineStep[] = [];
    let stepOrder = 1;

    for (const templateStep of template) {
      // Get product recommendations based on goals
      let productRecommendations: string[] = [];
      for (const goalType of goalTypes) {
        const goalRecs = GOAL_PRODUCT_RECOMMENDATIONS[goalType];
        if (goalRecs && goalRecs[templateStep.stepType]) {
          productRecommendations.push(...goalRecs[templateStep.stepType]);
        }
      }

      // Remove duplicates
      productRecommendations = [...new Set(productRecommendations)];

      const stepResult = await pool.query(
        `INSERT INTO routine_steps (
          routine_id, step_order, step_type, custom_product_name,
          instructions, duration_seconds, is_optional, frequency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          routine.id,
          stepOrder++,
          templateStep.stepType,
          productRecommendations.length > 0 ? productRecommendations[0] : templateStep.name,
          templateStep.instructions,
          templateStep.durationSeconds,
          templateStep.isOptional || false,
          templateStep.frequency,
        ]
      );

      steps.push(this.formatStep(stepResult.rows[0]));
    }

    return {
      ...this.formatRoutine(routine),
      steps,
    };
  }

  private formatRoutine(row: any): Omit<Routine, 'steps'> {
    return {
      id: row.id,
      userId: row.user_id,
      storeId: row.store_id,
      name: row.name,
      routineType: row.routine_type,
      isActive: row.is_active,
      generatedFromGoals: row.generated_from_goals,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private formatStep(row: any): RoutineStep {
    return {
      id: row.id,
      routineId: row.routine_id,
      stepOrder: row.step_order,
      stepType: row.step_type,
      productId: row.product_id,
      customProductName: row.custom_product_name,
      customProductBrand: row.custom_product_brand,
      instructions: row.instructions,
      durationSeconds: row.duration_seconds,
      isOptional: row.is_optional,
      frequency: row.frequency,
    };
  }

  private formatLog(row: any): RoutineLog {
    return {
      id: row.id,
      userId: row.user_id,
      routineId: row.routine_id,
      completedAt: row.completed_at,
      stepsCompleted: row.steps_completed || [],
      totalSteps: row.total_steps,
      completionPercent: row.completion_percent,
      skinFeeling: row.skin_feeling,
      notes: row.notes,
    };
  }
}

export default new RoutineGeneratorService();
