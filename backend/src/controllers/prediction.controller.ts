import { Response, NextFunction } from 'express';
import { WidgetAuthRequest } from '../middleware/widget-auth';
import predictionService from '../services/prediction.service';
import { createError } from '../middleware/errorHandler';

class PredictionController {
  /**
   * Generate prediction for a specific goal
   * POST /api/widget/predictions/goals/:goalId
   */
  async generateGoalPrediction(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { goalId } = req.params;

      const prediction = await predictionService.generateGoalPrediction(req.widgetUser.id, goalId);

      if (!prediction) {
        throw createError('Goal not found', 404);
      }

      res.json({
        success: true,
        data: { prediction },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate predictions for all active goals
   * GET /api/widget/predictions/goals
   */
  async getAllGoalPredictions(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const predictions = await predictionService.generateAllGoalPredictions(req.widgetUser.id);

      res.json({
        success: true,
        data: { predictions },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate prediction for a specific metric
   * GET /api/widget/predictions/metric/:metric
   */
  async getMetricPrediction(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { metric } = req.params;
      const weeks = parseInt(req.query.weeks as string) || 8;

      const validMetrics = [
        'skin_score', 'acne_score', 'wrinkle_score', 'hydration_score',
        'pigmentation_score', 'texture_score', 'redness_score', 'oiliness_score'
      ];

      if (!validMetrics.includes(metric)) {
        throw createError(`Invalid metric. Must be one of: ${validMetrics.join(', ')}`, 400);
      }

      const prediction = await predictionService.generateMetricPrediction(req.widgetUser.id, metric, weeks);

      if (!prediction) {
        throw createError('No data available for prediction', 404);
      }

      res.json({
        success: true,
        data: { prediction },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate face preview data
   * POST /api/widget/predictions/face-preview
   */
  async generateFacePreview(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { faceScanId, timeframeWeeks } = req.body;

      if (!faceScanId) {
        throw createError('faceScanId is required', 400);
      }

      const weeks = timeframeWeeks || 8;
      if (weeks < 1 || weeks > 24) {
        throw createError('timeframeWeeks must be between 1 and 24', 400);
      }

      const preview = await predictionService.generateFacePreview(req.widgetUser.id, faceScanId, weeks);

      if (!preview) {
        throw createError('Face scan not found', 404);
      }

      res.json({
        success: true,
        data: { preview },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get face preview history
   * GET /api/widget/predictions/face-previews
   */
  async getFacePreviewHistory(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const limit = parseInt(req.query.limit as string) || 10;

      const previews = await predictionService.getFacePreviewHistory(req.widgetUser.id, limit);

      res.json({
        success: true,
        data: { previews },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get overall progress summary with predictions
   * GET /api/widget/predictions/summary
   */
  async getProgressSummary(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const summary = await predictionService.getProgressSummary(req.widgetUser.id);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get saved predictions for a goal
   * GET /api/widget/predictions/goals/:goalId/saved
   */
  async getSavedPredictions(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { goalId } = req.params;

      const predictions = await predictionService.getSavedPredictions(req.widgetUser.id, goalId);

      res.json({
        success: true,
        data: { predictions },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PredictionController();
