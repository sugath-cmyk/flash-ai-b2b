import { Response, NextFunction } from 'express';
import { WidgetAuthRequest } from '../middleware/widget-auth';
import routineGeneratorService from '../services/routine-generator.service';
import { createError } from '../middleware/errorHandler';

class RoutinesController {
  async generateRoutines(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const routines = await routineGeneratorService.generateRoutines(
        req.widgetUser.id,
        req.widgetUser.storeId
      );

      res.status(201).json({
        success: true,
        data: routines,
        message: 'Routines generated based on your goals',
      });
    } catch (error) {
      next(error);
    }
  }

  async createRoutine(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { name, routineType, notes } = req.body;

      if (!routineType || !['am', 'pm', 'weekly'].includes(routineType)) {
        throw createError('routineType must be am, pm, or weekly', 400);
      }

      const routine = await routineGeneratorService.createRoutine({
        userId: req.widgetUser.id,
        storeId: req.widgetUser.storeId,
        name,
        routineType,
        notes,
      });

      res.status(201).json({
        success: true,
        data: { routine },
        message: 'Routine created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserRoutines(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const routines = await routineGeneratorService.getUserRoutines(req.widgetUser.id);

      res.json({
        success: true,
        data: { routines },
      });
    } catch (error) {
      next(error);
    }
  }

  async getRoutineById(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { routineId } = req.params;
      const routine = await routineGeneratorService.getRoutineById(routineId, req.widgetUser.id);

      if (!routine) {
        throw createError('Routine not found', 404);
      }

      res.json({
        success: true,
        data: { routine },
      });
    } catch (error) {
      next(error);
    }
  }

  async addStep(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { routineId } = req.params;
      const { stepType, productId, customProductName, customProductBrand, instructions, durationSeconds, isOptional, frequency } = req.body;

      if (!stepType) {
        throw createError('stepType is required', 400);
      }

      const step = await routineGeneratorService.addStep(routineId, req.widgetUser.id, {
        stepType,
        productId,
        customProductName,
        customProductBrand,
        instructions,
        durationSeconds,
        isOptional,
        frequency,
      });

      res.status(201).json({
        success: true,
        data: { step },
        message: 'Step added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStep(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { stepId } = req.params;
      const updates = req.body;

      const step = await routineGeneratorService.updateStep(stepId, req.widgetUser.id, updates);

      res.json({
        success: true,
        data: { step },
        message: 'Step updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteStep(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { stepId } = req.params;
      await routineGeneratorService.deleteStep(stepId, req.widgetUser.id);

      res.json({
        success: true,
        message: 'Step deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async logCompletion(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { routineId } = req.params;
      const { stepsCompleted, skinFeeling, notes } = req.body;

      if (!stepsCompleted || !Array.isArray(stepsCompleted)) {
        throw createError('stepsCompleted array is required', 400);
      }

      const log = await routineGeneratorService.logCompletion(req.widgetUser.id, routineId, {
        stepsCompleted,
        skinFeeling,
        notes,
      });

      res.status(201).json({
        success: true,
        data: { log },
        message: 'Routine completion logged',
      });
    } catch (error) {
      next(error);
    }
  }

  async getRoutineLogs(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const routineId = req.query.routineId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 30;

      const logs = await routineGeneratorService.getRoutineLogs(req.widgetUser.id, routineId, limit);

      res.json({
        success: true,
        data: { logs },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const stats = await routineGeneratorService.getRoutineStats(req.widgetUser.id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRoutine(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { routineId } = req.params;
      await routineGeneratorService.deleteRoutine(routineId, req.widgetUser.id);

      res.json({
        success: true,
        message: 'Routine deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // PHASE MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * Get current phase info
   * GET /api/widget/routines/phase
   */
  async getPhase(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const phaseInfo = await routineGeneratorService.getPhaseInfo(req.widgetUser.id);

      res.json({
        success: true,
        data: phaseInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Advance to next phase (manual confirmation)
   * POST /api/widget/routines/phase/advance
   */
  async advancePhase(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { reason } = req.body;
      const newPhase = await routineGeneratorService.advancePhase(req.widgetUser.id, reason);

      // Regenerate routines for the new phase
      if (newPhase) {
        await routineGeneratorService.generatePhaseRoutine(
          req.widgetUser.id,
          req.widgetUser.storeId,
          newPhase.phaseNumber
        );
      }

      res.json({
        success: true,
        data: { phase: newPhase },
        message: `Advanced to ${newPhase?.phaseName || 'next phase'}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit questionnaire and initialize phase
   * POST /api/widget/routines/questionnaire
   */
  async submitQuestionnaire(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const {
        skincareExperience,
        skinSensitivity,
        routineConsistency,
        usedActives,
        ageRange,
      } = req.body;

      // Validate required fields
      if (!skincareExperience || !skinSensitivity || !routineConsistency) {
        throw createError('Missing required questionnaire fields', 400);
      }

      // Get prioritized concerns from user's goals
      const { primary, secondary } = await routineGeneratorService.prioritizeConcerns(
        req.widgetUser.id
      );

      // Initialize phase based on questionnaire
      const phase = await routineGeneratorService.initializeUserPhase(
        req.widgetUser.id,
        {
          skincareExperience,
          skinSensitivity,
          routineConsistency,
          usedActives: usedActives || [],
          ageRange,
        },
        primary || undefined,
        secondary || undefined
      );

      // Generate phase-appropriate routines
      const routines = await routineGeneratorService.generatePhaseRoutine(
        req.widgetUser.id,
        req.widgetUser.storeId,
        phase.phaseNumber
      );

      res.status(201).json({
        success: true,
        data: {
          phase,
          routines,
          message: `Starting at Phase ${phase.phaseNumber}: ${phase.phaseName}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get phase templates (public reference)
   * GET /api/widget/routines/phase/templates
   */
  async getPhaseTemplates(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      // Return phase template data for UI display
      const templates = [
        {
          phaseNumber: 1,
          name: 'Foundation',
          durationWeeks: 2,
          description: 'Build healthy habits with core essentials',
          amSteps: ['cleanser', 'moisturizer', 'sunscreen'],
          pmSteps: ['cleanser', 'moisturizer'],
          activeFrequency: 'daily',
          tips: [
            { text: 'Apply sunscreen every morning, even on cloudy days', icon: '☀️' },
            { text: 'Use lukewarm water, not hot, when cleansing', icon: '💧' },
            { text: 'Pat dry gently, don\'t rub your face', icon: '✋' },
          ],
        },
        {
          phaseNumber: 2,
          name: 'First Active',
          durationWeeks: 2,
          description: 'Introduce your first treatment product slowly',
          amSteps: ['cleanser', 'moisturizer', 'sunscreen'],
          pmSteps: ['cleanser', 'serum', 'moisturizer'],
          activeFrequency: '2x_week',
          tips: [
            { text: 'Apply treatment serum before moisturizer', icon: '✨' },
            { text: 'Skip treatment nights if skin feels irritated', icon: '⚠️' },
            { text: 'Slight tingling is normal, burning is not', icon: '🔥' },
          ],
        },
        {
          phaseNumber: 3,
          name: 'Build Tolerance',
          durationWeeks: 2,
          description: 'Increase treatment frequency as skin adjusts',
          amSteps: ['cleanser', 'moisturizer', 'sunscreen'],
          pmSteps: ['cleanser', 'serum', 'moisturizer'],
          activeFrequency: '3x_week',
          tips: [
            { text: 'Now using treatment 3x per week', icon: '📈' },
            { text: 'Continue monitoring for irritation', icon: '👀' },
            { text: 'Results take 4-8 weeks to show', icon: '⏰' },
          ],
        },
        {
          phaseNumber: 4,
          name: 'Full Routine',
          durationWeeks: null,
          description: 'Your complete personalized routine',
          amSteps: ['cleanser', 'toner', 'serum', 'eye_cream', 'moisturizer', 'sunscreen'],
          pmSteps: ['makeup_remover', 'cleanser', 'exfoliant', 'toner', 'serum', 'treatment', 'eye_cream', 'moisturizer', 'face_oil'],
          activeFrequency: 'every_other_day',
          tips: [
            { text: 'You\'ve built a strong foundation!', icon: '🎉' },
            { text: 'Listen to your skin and adjust as needed', icon: '👂' },
            { text: 'Reassess routine every 3-6 months', icon: '📅' },
          ],
        },
      ];

      res.json({
        success: true,
        data: { templates },
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // CALENDAR ENDPOINTS
  // ============================================================================

  /**
   * Get monthly calendar data
   * GET /api/widget/routines/calendar?month=2026-01
   */
  async getCalendar(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      // Default to current month if not specified
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        throw createError('Invalid month format. Use YYYY-MM', 400);
      }

      const calendarData = await routineGeneratorService.getMonthlyCalendar(
        req.widgetUser.id,
        month
      );

      res.json({
        success: true,
        data: calendarData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate phase-aware routines
   * POST /api/widget/routines/generate-phase
   */
  async generatePhaseRoutines(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      // Get user's current phase
      const phaseInfo = await routineGeneratorService.getPhaseInfo(req.widgetUser.id);
      const phaseNumber = phaseInfo.phase?.phaseNumber || 1;

      const routines = await routineGeneratorService.generatePhaseRoutine(
        req.widgetUser.id,
        req.widgetUser.storeId,
        phaseNumber
      );

      res.status(201).json({
        success: true,
        data: routines,
        message: `Routines generated for Phase ${phaseNumber}: ${phaseInfo.phase?.phaseName || 'Foundation'}`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new RoutinesController();
