import { Response, NextFunction } from 'express';
import { WidgetAuthRequest } from '../middleware/widget-auth';
import goalService from '../services/goal.service';
import { createError } from '../middleware/errorHandler';

class GoalsController {
  async getTemplates(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const templates = await goalService.getTemplates();

      res.json({
        success: true,
        data: { templates },
      });
    } catch (error) {
      next(error);
    }
  }

  async getSuggestions(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const suggestions = await goalService.getGoalSuggestions(req.widgetUser.id);

      res.json({
        success: true,
        data: { suggestions },
      });
    } catch (error) {
      next(error);
    }
  }

  async createGoal(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { templateId, goalType, goalName, targetMetric, targetValue, targetWeeks } = req.body;

      const goal = await goalService.createGoal({
        userId: req.widgetUser.id,
        storeId: req.widgetUser.storeId,
        templateId,
        goalType,
        goalName,
        targetMetric,
        targetValue,
        targetWeeks,
      });

      res.status(201).json({
        success: true,
        data: { goal },
        message: 'Goal created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserGoals(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const status = req.query.status as string | undefined;
      const goals = await goalService.getUserGoals(req.widgetUser.id, status);

      res.json({
        success: true,
        data: { goals },
      });
    } catch (error) {
      next(error);
    }
  }

  async getGoalById(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { goalId } = req.params;
      const goal = await goalService.getGoalById(goalId, req.widgetUser.id);

      if (!goal) {
        throw createError('Goal not found', 404);
      }

      res.json({
        success: true,
        data: { goal },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateGoalStatus(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { goalId } = req.params;
      const { status } = req.body;

      if (!['active', 'paused', 'abandoned'].includes(status)) {
        throw createError('Invalid status. Must be active, paused, or abandoned', 400);
      }

      const goal = await goalService.updateGoalStatus(goalId, req.widgetUser.id, status);

      res.json({
        success: true,
        data: { goal },
        message: `Goal ${status === 'active' ? 'resumed' : status}`,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteGoal(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { goalId } = req.params;
      await goalService.deleteGoal(goalId, req.widgetUser.id);

      res.json({
        success: true,
        message: 'Goal deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new GoalsController();
