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
}

export default new RoutinesController();
