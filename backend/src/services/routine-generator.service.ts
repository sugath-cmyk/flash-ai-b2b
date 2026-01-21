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
  { stepType: 'sunscreen', name: 'Broad Spectrum SPF 50+', instructions: 'Apply generously 15 min before sun exposure. Reapply every 2 hours if outdoors.', durationSeconds: 45, frequency: 'daily' },
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

// ============================================================================
// PHASE-BASED ROUTINE SYSTEM (Dermatologist-backed)
// Based on AAD, Skin Cancer Foundation, and clinical research
// ============================================================================

// Phase templates - graduated introduction of products
const PHASE_TEMPLATES: Record<number, {
  name: string;
  durationWeeks: number | null;
  description: string;
  amSteps: string[];
  pmSteps: string[];
  activeFrequency: string;
}> = {
  1: {
    name: 'Foundation',
    durationWeeks: 2,
    description: 'Build healthy habits with core essentials',
    amSteps: ['cleanser', 'moisturizer', 'sunscreen'],
    pmSteps: ['cleanser', 'moisturizer'],
    activeFrequency: 'daily'
  },
  2: {
    name: 'First Active',
    durationWeeks: 2,
    description: 'Introduce your first treatment product slowly',
    amSteps: ['cleanser', 'moisturizer', 'sunscreen'],
    pmSteps: ['cleanser', 'serum', 'moisturizer'],
    activeFrequency: '2x_week'
  },
  3: {
    name: 'Build Tolerance',
    durationWeeks: 2,
    description: 'Increase treatment frequency as skin adjusts',
    amSteps: ['cleanser', 'moisturizer', 'sunscreen'],
    pmSteps: ['cleanser', 'serum', 'moisturizer'],
    activeFrequency: '3x_week'
  },
  4: {
    name: 'Full Routine',
    durationWeeks: null, // Ongoing
    description: 'Your complete personalized routine',
    amSteps: ['cleanser', 'toner', 'serum', 'eye_cream', 'moisturizer', 'sunscreen'],
    pmSteps: ['makeup_remover', 'cleanser', 'exfoliant', 'toner', 'serum', 'treatment', 'eye_cream', 'moisturizer', 'face_oil'],
    activeFrequency: 'every_other_day'
  }
};

// Skin cycle duration by age (for education and timeline)
const SKIN_CYCLE_BY_AGE: Record<string, { minDays: number; maxDays: number; description: string }> = {
  'teens': { minDays: 14, maxDays: 21, description: 'Faster cell turnover' },
  '20s': { minDays: 21, maxDays: 28, description: 'Optimal regeneration' },
  '30s': { minDays: 28, maxDays: 35, description: 'Slightly slower turnover' },
  '40s': { minDays: 35, maxDays: 45, description: 'Mature skin cycle' },
  '50s': { minDays: 45, maxDays: 60, description: 'Extended renewal period' },
  '60+': { minDays: 60, maxDays: 90, description: 'Longer cycle - patience is key' }
};

// Priority active ingredients by concern (first active to introduce)
const PRIMARY_ACTIVES_BY_CONCERN: Record<string, { active: string; name: string; benefit: string }> = {
  clear_acne: { active: 'niacinamide', name: 'Niacinamide Serum', benefit: 'Reduces oil and inflammation without irritation' },
  reduce_wrinkles: { active: 'retinol', name: 'Retinol Serum (0.25%)', benefit: 'Start low to build tolerance' },
  improve_hydration: { active: 'hyaluronic_acid', name: 'Hyaluronic Acid Serum', benefit: 'Deeply hydrates without heaviness' },
  even_tone: { active: 'vitamin_c', name: 'Vitamin C Serum (10-15%)', benefit: 'Brightens and protects' },
  smooth_texture: { active: 'aha', name: 'Gentle AHA Treatment', benefit: 'Exfoliates dead skin cells' },
  reduce_redness: { active: 'centella', name: 'Centella/Cica Serum', benefit: 'Calms and soothes inflammation' },
  control_oil: { active: 'niacinamide', name: 'Niacinamide Serum', benefit: 'Regulates sebum production' }
};

// Phase interface
interface UserPhase {
  id: string;
  userId: string;
  phaseNumber: number;
  phaseName: string;
  startedAt: string;
  targetEndAt: string | null;
  primaryConcern: string | null;
  secondaryConcern: string | null;
  primaryActive: string | null;
  currentFrequency: string;
  completedAt: string | null;
}

// Calendar data interfaces
interface CalendarDay {
  date: string;
  am: { completed: boolean; percent: number; logId?: string };
  pm: { completed: boolean; percent: number; logId?: string };
  isToday: boolean;
  isFuture: boolean;
}

interface MonthlyCalendarResponse {
  month: string;
  days: CalendarDay[];
  stats: {
    completedDays: number;
    totalDays: number;
    currentStreak: number;
    longestStreak: number;
    amCompletionRate: number;
    pmCompletionRate: number;
  };
  phase: {
    number: number;
    name: string;
    weekInPhase: number;
    totalWeeks: number | null;
    canAdvance: boolean;
    primaryActive: string | null;
  };
}

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

  // ============================================================================
  // PHASE MANAGEMENT METHODS
  // ============================================================================

  /**
   * Get or create user's current phase
   */
  async getUserPhase(userId: string): Promise<UserPhase | null> {
    // Get active (non-completed) phase
    const result = await pool.query(
      `SELECT * FROM routine_phases
       WHERE user_id = $1 AND completed_at IS NULL
       ORDER BY phase_number DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatPhase(result.rows[0]);
  }

  /**
   * Initialize user's phase based on questionnaire answers
   */
  async initializeUserPhase(
    userId: string,
    questionnaireData: {
      skincareExperience: 'none' | 'basic' | 'intermediate' | 'advanced';
      skinSensitivity: 'very_sensitive' | 'moderate' | 'tolerant';
      routineConsistency: 'struggling' | 'sometimes' | 'consistent';
      usedActives: string[];
      ageRange?: string;
    },
    primaryConcern?: string,
    secondaryConcern?: string
  ): Promise<UserPhase> {
    // Determine starting phase based on answers
    let startingPhase = 1;

    const { skincareExperience, skinSensitivity, routineConsistency, usedActives } = questionnaireData;

    // Advanced users with retinol experience can start at Phase 4
    if (skincareExperience === 'advanced' && usedActives.includes('retinol') && skinSensitivity !== 'very_sensitive') {
      startingPhase = 4;
    }
    // Intermediate users with some actives can start at Phase 2 or 3
    else if (skincareExperience === 'intermediate' && usedActives.length > 0) {
      startingPhase = skinSensitivity === 'very_sensitive' ? 2 : 3;
    }
    // Basic routine users with tolerance can start at Phase 2
    else if (skincareExperience === 'basic' && routineConsistency === 'consistent' && skinSensitivity !== 'very_sensitive') {
      startingPhase = 2;
    }
    // Everyone else starts at Phase 1

    // Update user profile with questionnaire data
    await pool.query(
      `UPDATE widget_users SET
        skincare_experience = $2,
        skin_sensitivity = $3,
        routine_consistency = $4,
        used_actives = $5,
        age_range = $6,
        questionnaire_completed_at = NOW()
       WHERE id = $1`,
      [
        userId,
        skincareExperience,
        skinSensitivity,
        routineConsistency,
        usedActives,
        questionnaireData.ageRange || null
      ]
    );

    // Get primary active based on concern
    const primaryActive = primaryConcern ? PRIMARY_ACTIVES_BY_CONCERN[primaryConcern] : null;

    // Calculate target end date
    const phaseTemplate = PHASE_TEMPLATES[startingPhase];
    const targetEndAt = phaseTemplate.durationWeeks
      ? new Date(Date.now() + phaseTemplate.durationWeeks * 7 * 24 * 60 * 60 * 1000)
      : null;

    // Create phase record
    const result = await pool.query(
      `INSERT INTO routine_phases (
        user_id, phase_number, phase_name, target_end_at,
        primary_concern, secondary_concern, primary_active, current_frequency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, phase_number) DO UPDATE SET
        started_at = NOW(),
        target_end_at = $4,
        primary_concern = $5,
        secondary_concern = $6,
        primary_active = $7,
        current_frequency = $8,
        completed_at = NULL,
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        startingPhase,
        phaseTemplate.name,
        targetEndAt,
        primaryConcern || null,
        secondaryConcern || null,
        primaryActive?.active || null,
        phaseTemplate.activeFrequency
      ]
    );

    return this.formatPhase(result.rows[0]);
  }

  /**
   * Advance user to next phase (manual confirmation)
   */
  async advancePhase(
    userId: string,
    reason?: string
  ): Promise<UserPhase | null> {
    const currentPhase = await this.getUserPhase(userId);
    if (!currentPhase) {
      throw createError('No active phase found', 404);
    }

    if (currentPhase.phaseNumber >= 4) {
      throw createError('Already at maximum phase', 400);
    }

    // Mark current phase as completed
    await pool.query(
      `UPDATE routine_phases SET completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [currentPhase.id]
    );

    // Log the advancement
    await pool.query(
      `INSERT INTO phase_advancement_logs (user_id, from_phase, to_phase, advancement_type, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, currentPhase.phaseNumber, currentPhase.phaseNumber + 1, 'manual', reason || null]
    );

    // Create next phase
    const nextPhaseNumber = currentPhase.phaseNumber + 1;
    const nextTemplate = PHASE_TEMPLATES[nextPhaseNumber];
    const targetEndAt = nextTemplate.durationWeeks
      ? new Date(Date.now() + nextTemplate.durationWeeks * 7 * 24 * 60 * 60 * 1000)
      : null;

    const result = await pool.query(
      `INSERT INTO routine_phases (
        user_id, phase_number, phase_name, target_end_at,
        primary_concern, secondary_concern, primary_active, current_frequency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        userId,
        nextPhaseNumber,
        nextTemplate.name,
        targetEndAt,
        currentPhase.primaryConcern,
        currentPhase.secondaryConcern,
        currentPhase.primaryActive,
        nextTemplate.activeFrequency
      ]
    );

    return this.formatPhase(result.rows[0]);
  }

  /**
   * Get phase info with progress details
   */
  async getPhaseInfo(userId: string): Promise<{
    phase: UserPhase | null;
    template: typeof PHASE_TEMPLATES[1];
    weekInPhase: number;
    daysRemaining: number | null;
    canAdvance: boolean;
    nextPhasePreview: { name: string; description: string; activeFrequency: string } | null;
    skinCycleInfo: typeof SKIN_CYCLE_BY_AGE[string] | null;
  }> {
    const phase = await this.getUserPhase(userId);

    if (!phase) {
      return {
        phase: null,
        template: PHASE_TEMPLATES[1],
        weekInPhase: 0,
        daysRemaining: null,
        canAdvance: false,
        nextPhasePreview: {
          name: PHASE_TEMPLATES[1].name,
          description: PHASE_TEMPLATES[1].description,
          activeFrequency: PHASE_TEMPLATES[1].activeFrequency
        },
        skinCycleInfo: null
      };
    }

    const template = PHASE_TEMPLATES[phase.phaseNumber];
    const startedAt = new Date(phase.startedAt);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - startedAt.getTime()) / (24 * 60 * 60 * 1000));
    const weekInPhase = Math.floor(daysSinceStart / 7) + 1;

    let daysRemaining: number | null = null;
    if (phase.targetEndAt) {
      const targetEnd = new Date(phase.targetEndAt);
      daysRemaining = Math.max(0, Math.floor((targetEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    }

    // Can advance if phase duration is complete or nearly complete
    const canAdvance = phase.phaseNumber < 4 && (
      daysRemaining === null ||
      daysRemaining <= 0 ||
      daysSinceStart >= (template.durationWeeks || 0) * 7 * 0.8 // 80% through
    );

    // Next phase preview
    const nextPhasePreview = phase.phaseNumber < 4 ? {
      name: PHASE_TEMPLATES[phase.phaseNumber + 1].name,
      description: PHASE_TEMPLATES[phase.phaseNumber + 1].description,
      activeFrequency: PHASE_TEMPLATES[phase.phaseNumber + 1].activeFrequency
    } : null;

    // Get user's age range for skin cycle info
    const userResult = await pool.query(
      `SELECT age_range FROM widget_users WHERE id = $1`,
      [userId]
    );
    const ageRange = userResult.rows[0]?.age_range;
    const skinCycleInfo = ageRange ? SKIN_CYCLE_BY_AGE[ageRange] : null;

    return {
      phase,
      template,
      weekInPhase,
      daysRemaining,
      canAdvance,
      nextPhasePreview,
      skinCycleInfo
    };
  }

  // ============================================================================
  // CALENDAR METHODS
  // ============================================================================

  /**
   * Get monthly calendar data for routine tracking
   */
  async getMonthlyCalendar(userId: string, month: string): Promise<MonthlyCalendarResponse> {
    // Parse month (format: 'YYYY-MM')
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // Last day of month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all routine logs for this month
    const logsResult = await pool.query(
      `SELECT
        rl.id,
        rl.routine_id,
        DATE(rl.completed_at) as log_date,
        rl.completion_percent,
        ur.routine_type
       FROM routine_logs rl
       JOIN user_routines ur ON rl.routine_id = ur.id
       WHERE rl.user_id = $1
         AND rl.completed_at >= $2
         AND rl.completed_at < $3
       ORDER BY rl.completed_at`,
      [userId, startDate, new Date(year, monthNum, 1)]
    );

    // Group logs by date
    const logsByDate: Record<string, { am?: any; pm?: any }> = {};
    for (const log of logsResult.rows) {
      const dateStr = log.log_date.toISOString().split('T')[0];
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = {};
      }
      if (log.routine_type === 'am') {
        logsByDate[dateStr].am = log;
      } else if (log.routine_type === 'pm') {
        logsByDate[dateStr].pm = log;
      }
    }

    // Build calendar days
    const days: CalendarDay[] = [];
    for (let d = 1; d <= endDate.getDate(); d++) {
      const date = new Date(year, monthNum - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayLogs = logsByDate[dateStr];
      const isToday = date.getTime() === today.getTime();
      const isFuture = date > today;

      days.push({
        date: dateStr,
        am: {
          completed: !!dayLogs?.am,
          percent: dayLogs?.am?.completion_percent || 0,
          logId: dayLogs?.am?.id
        },
        pm: {
          completed: !!dayLogs?.pm,
          percent: dayLogs?.pm?.completion_percent || 0,
          logId: dayLogs?.pm?.id
        },
        isToday,
        isFuture
      });
    }

    // Calculate stats
    const pastDays = days.filter(d => !d.isFuture);
    const completedDays = pastDays.filter(d => d.am.completed || d.pm.completed).length;
    const amCompleted = pastDays.filter(d => d.am.completed).length;
    const pmCompleted = pastDays.filter(d => d.pm.completed).length;

    // Calculate current streak
    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const day = days[i];
      if (day.isFuture) continue;
      if (day.isToday && !day.am.completed && !day.pm.completed) continue; // Skip today if nothing done yet
      if (day.am.completed || day.pm.completed) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    for (const day of days) {
      if (day.isFuture) continue;
      if (day.am.completed || day.pm.completed) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Get phase info
    const phaseInfo = await this.getPhaseInfo(userId);

    return {
      month,
      days,
      stats: {
        completedDays,
        totalDays: pastDays.length,
        currentStreak,
        longestStreak,
        amCompletionRate: pastDays.length > 0 ? Math.round((amCompleted / pastDays.length) * 100) : 0,
        pmCompletionRate: pastDays.length > 0 ? Math.round((pmCompleted / pastDays.length) * 100) : 0
      },
      phase: {
        number: phaseInfo.phase?.phaseNumber || 1,
        name: phaseInfo.phase?.phaseName || 'Foundation',
        weekInPhase: phaseInfo.weekInPhase,
        totalWeeks: phaseInfo.template.durationWeeks,
        canAdvance: phaseInfo.canAdvance,
        primaryActive: phaseInfo.phase?.primaryActive || null
      }
    };
  }

  /**
   * Prioritize concerns from goals by severity
   */
  async prioritizeConcerns(userId: string): Promise<{ primary: string | null; secondary: string | null }> {
    // Get user's active goals with their baseline values
    const goalsResult = await pool.query(
      `SELECT goal_type, baseline_value, target_value, current_value
       FROM user_goals
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at`,
      [userId]
    );

    if (goalsResult.rows.length === 0) {
      return { primary: null, secondary: null };
    }

    // Calculate severity for each goal
    const goalsWithSeverity = goalsResult.rows.map((goal: any) => {
      const baseline = goal.baseline_value || 50;
      // For goals where lower is better (acne, wrinkles, redness, oiliness)
      const lowerIsBetter = ['clear_acne', 'reduce_wrinkles', 'reduce_redness', 'control_oil', 'even_tone', 'smooth_texture'].includes(goal.goal_type);

      let severity: number;
      if (lowerIsBetter) {
        // Higher baseline = more severe problem
        severity = baseline;
      } else {
        // Lower baseline = more severe problem (e.g., hydration)
        severity = 100 - baseline;
      }

      return {
        goalType: goal.goal_type,
        severity
      };
    });

    // Sort by severity descending
    goalsWithSeverity.sort((a, b) => b.severity - a.severity);

    return {
      primary: goalsWithSeverity[0]?.goalType || null,
      secondary: goalsWithSeverity[1]?.goalType || null
    };
  }

  /**
   * Generate phase-filtered routine
   */
  async generatePhaseRoutine(
    userId: string,
    storeId: string,
    phaseNumber: number
  ): Promise<{ am: Routine; pm: Routine }> {
    const phaseTemplate = PHASE_TEMPLATES[phaseNumber];
    if (!phaseTemplate) {
      throw createError('Invalid phase number', 400);
    }

    const isDemoStore = storeId === 'demo-store' || storeId === 'demo' || storeId === 'test';
    const actualStoreId = isDemoStore ? DEMO_FALLBACK_STORE_UUID : storeId;

    // Get user's goals and prioritize
    const { primary, secondary } = await this.prioritizeConcerns(userId);
    const goalTypes = [primary, secondary].filter(Boolean) as string[];

    // Get phase info for active frequency
    const phaseInfo = await this.getUserPhase(userId);
    const activeFrequency = phaseInfo?.currentFrequency || phaseTemplate.activeFrequency;

    // Create AM routine with phase-filtered steps
    const amRoutine = await this.createPhaseRoutine(
      userId,
      actualStoreId,
      'am',
      `Morning Routine (${phaseTemplate.name})`,
      phaseTemplate.amSteps,
      goalTypes,
      activeFrequency
    );

    // Create PM routine with phase-filtered steps
    const pmRoutine = await this.createPhaseRoutine(
      userId,
      actualStoreId,
      'pm',
      `Evening Routine (${phaseTemplate.name})`,
      phaseTemplate.pmSteps,
      goalTypes,
      activeFrequency
    );

    return { am: amRoutine, pm: pmRoutine };
  }

  /**
   * Create a routine with only phase-appropriate steps
   */
  private async createPhaseRoutine(
    userId: string,
    storeId: string,
    routineType: 'am' | 'pm',
    name: string,
    allowedStepTypes: string[],
    goalTypes: string[],
    activeFrequency: string
  ): Promise<Routine> {
    // Use the appropriate template
    const fullTemplate = routineType === 'am' ? AM_ROUTINE_TEMPLATE : PM_ROUTINE_TEMPLATE;

    // Filter template to only allowed step types
    const filteredTemplate = fullTemplate.filter(step => allowedStepTypes.includes(step.stepType));

    // Check if routine already exists
    const existingRoutine = await pool.query(
      `SELECT id FROM user_routines
       WHERE user_id = $1 AND routine_type = $2 AND is_active = true`,
      [userId, routineType]
    );

    // Deactivate existing routine
    if (existingRoutine.rows.length > 0) {
      await pool.query(
        `UPDATE user_routines SET is_active = false WHERE id = $1`,
        [existingRoutine.rows[0].id]
      );
    }

    // Create new routine
    const routineResult = await pool.query(
      `INSERT INTO user_routines (user_id, store_id, name, routine_type, generated_from_goals)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [userId, storeId, name, routineType]
    );

    const routine = routineResult.rows[0];
    const steps: RoutineStep[] = [];
    let stepOrder = 1;

    for (const templateStep of filteredTemplate) {
      // Get product recommendations based on goals
      let productRecommendations: string[] = [];
      for (const goalType of goalTypes) {
        const goalRecs = GOAL_PRODUCT_RECOMMENDATIONS[goalType];
        if (goalRecs && goalRecs[templateStep.stepType]) {
          productRecommendations.push(...goalRecs[templateStep.stepType]);
        }
      }
      productRecommendations = [...new Set(productRecommendations)];

      // Determine frequency based on whether this is an "active" step
      const isActiveStep = ['serum', 'treatment', 'exfoliant'].includes(templateStep.stepType);
      const stepFrequency = isActiveStep ? activeFrequency : (templateStep.frequency || 'daily');

      // Update routine step with phase info
      const stepResult = await pool.query(
        `INSERT INTO routine_steps (
          routine_id, step_order, step_type, custom_product_name,
          instructions, duration_seconds, is_optional, frequency,
          is_active_step, min_phase
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          routine.id,
          stepOrder++,
          templateStep.stepType,
          productRecommendations.length > 0 ? productRecommendations[0] : templateStep.name,
          templateStep.instructions,
          templateStep.durationSeconds,
          templateStep.isOptional || false,
          stepFrequency,
          isActiveStep,
          isActiveStep ? 2 : 1 // Active steps start at Phase 2
        ]
      );

      steps.push(this.formatStep(stepResult.rows[0]));
    }

    return {
      ...this.formatRoutine(routine),
      steps,
    };
  }

  private formatPhase(row: any): UserPhase {
    return {
      id: row.id,
      userId: row.user_id,
      phaseNumber: row.phase_number,
      phaseName: row.phase_name,
      startedAt: row.started_at,
      targetEndAt: row.target_end_at,
      primaryConcern: row.primary_concern,
      secondaryConcern: row.secondary_concern,
      primaryActive: row.primary_active,
      currentFrequency: row.current_frequency,
      completedAt: row.completed_at
    };
  }
}

export default new RoutineGeneratorService();
