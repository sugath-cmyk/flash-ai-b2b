import { Response, NextFunction } from 'express';
import { WidgetAuthRequest } from '../middleware/widget-auth';
import progressTrackingService from '../services/progress-tracking.service';
import { createError } from '../middleware/errorHandler';

class ProgressController {
  async getTimeline(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const limit = parseInt(req.query.limit as string, 10) || 20;
      const timeline = await progressTrackingService.getTimeline(req.widgetUser.id, limit);

      res.json({
        success: true,
        data: { timeline },
      });
    } catch (error) {
      next(error);
    }
  }

  async getLatest(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const progress = await progressTrackingService.getLatestProgress(req.widgetUser.id);

      res.json({
        success: true,
        data: { progress },
      });
    } catch (error) {
      next(error);
    }
  }

  async compareScans(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { beforeScanId, afterScanId } = req.query;

      if (!beforeScanId || !afterScanId) {
        throw createError('beforeScanId and afterScanId are required', 400);
      }

      const comparison = await progressTrackingService.compareScans(
        req.widgetUser.id,
        beforeScanId as string,
        afterScanId as string
      );

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      next(error);
    }
  }

  async compareWithFirst(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const comparison = await progressTrackingService.compareWithFirst(req.widgetUser.id);

      if (!comparison) {
        res.json({
          success: true,
          data: null,
          message: 'Need at least 2 scans to compare',
        });
        return;
      }

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      next(error);
    }
  }

  async getChartData(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { metric } = req.params;
      const days = parseInt(req.query.days as string, 10) || 90;

      if (!metric) {
        throw createError('Metric is required', 400);
      }

      const chartData = await progressTrackingService.getChartData(
        req.widgetUser.id,
        metric,
        days
      );

      res.json({
        success: true,
        data: { metric, chartData },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllChartsData(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const days = parseInt(req.query.days as string, 10) || 90;
      const allCharts = await progressTrackingService.getAllMetricsChartData(
        req.widgetUser.id,
        days
      );

      res.json({
        success: true,
        data: { charts: allCharts },
      });
    } catch (error) {
      next(error);
    }
  }

  async getMilestones(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const milestones = await progressTrackingService.getMilestones(req.widgetUser.id);

      res.json({
        success: true,
        data: { milestones },
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const summary = await progressTrackingService.getSummary(req.widgetUser.id);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async createSnapshot(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { faceScanId, analysisResult } = req.body;

      if (!faceScanId || !analysisResult) {
        throw createError('faceScanId and analysisResult are required', 400);
      }

      const snapshot = await progressTrackingService.createProgressSnapshot(
        req.widgetUser.id,
        req.widgetUser.storeId,
        faceScanId,
        analysisResult
      );

      res.status(201).json({
        success: true,
        data: { snapshot },
        message: 'Progress snapshot created',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ProgressController();
