import { Response, NextFunction } from 'express';
import { WidgetAuthRequest } from '../middleware/widget-auth';
import feedbackService from '../services/feedback.service';
import learningEngineService from '../services/learning-engine.service';
import { createError } from '../middleware/errorHandler';

class FeedbackController {
  /**
   * Record explicit feedback on a product
   * POST /api/widget/feedback
   */
  async recordFeedback(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { productId, faceScanId, feedbackType, rating, effectivenessRating, comment } = req.body;

      if (!productId) {
        throw createError('productId is required', 400);
      }

      if (!feedbackType || !['rating', 'purchase', 'dismiss', 'save', 'effectiveness'].includes(feedbackType)) {
        throw createError('feedbackType must be rating, purchase, dismiss, save, or effectiveness', 400);
      }

      const feedback = await feedbackService.recordFeedback({
        userId: req.widgetUser.id,
        storeId: req.widgetUser.storeId,
        productId,
        faceScanId,
        feedbackType,
        rating,
        effectivenessRating,
        comment,
      });

      res.status(201).json({
        success: true,
        data: { feedback },
        message: 'Feedback recorded successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record behavior signal (implicit feedback)
   * POST /api/widget/feedback/signal
   */
  async recordSignal(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { signalType, productId, faceScanId, sessionId, durationSeconds, metadata } = req.body;

      if (!productId) {
        throw createError('productId is required', 400);
      }

      if (!signalType || !['product_view', 'add_to_cart', 'purchase', 'remove_from_cart', 'wishlist_add', 'compare', 'product_click'].includes(signalType)) {
        throw createError('Invalid signalType', 400);
      }

      const signal = await feedbackService.recordBehaviorSignal({
        userId: req.widgetUser.id,
        storeId: req.widgetUser.storeId,
        signalType,
        productId,
        faceScanId,
        sessionId,
        durationSeconds,
        metadata,
      });

      res.status(201).json({
        success: true,
        data: { signal },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's feedback history
   * GET /api/widget/feedback
   */
  async getUserFeedback(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const feedback = await feedbackService.getUserFeedback(req.widgetUser.id, limit);

      res.json({
        success: true,
        data: { feedback },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's saved products
   * GET /api/widget/feedback/saved
   */
  async getSavedProducts(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const productIds = await feedbackService.getUserSavedProducts(req.widgetUser.id);

      res.json({
        success: true,
        data: { productIds },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a saved product
   * DELETE /api/widget/feedback/saved/:productId
   */
  async removeSavedProduct(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { productId } = req.params;
      await feedbackService.removeSavedProduct(req.widgetUser.id, productId);

      res.json({
        success: true,
        message: 'Product removed from saved list',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's purchased products
   * GET /api/widget/feedback/purchased
   */
  async getPurchasedProducts(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const productIds = await feedbackService.getUserPurchasedProducts(req.widgetUser.id);

      res.json({
        success: true,
        data: { productIds },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pending effectiveness feedback requests
   * GET /api/widget/feedback/pending-effectiveness
   */
  async getPendingEffectiveness(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const pending = await feedbackService.getPendingEffectivenessFeedback(req.widgetUser.id);

      res.json({
        success: true,
        data: { pendingFeedback: pending },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product statistics (public - for product pages)
   * GET /api/widget/feedback/product/:productId/stats
   */
  async getProductStats(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const stats = await feedbackService.getProductFeedbackStats(productId);

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get personalized recommendation boosts for products
   * POST /api/widget/feedback/personalized-boosts
   */
  async getPersonalizedBoosts(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { productIds } = req.body;

      if (!productIds || !Array.isArray(productIds)) {
        throw createError('productIds array is required', 400);
      }

      const boosts = await learningEngineService.getPersonalizedBoosts(req.widgetUser.id, productIds);

      // Convert Map to object for JSON response
      const boostsObject: Record<string, number> = {};
      boosts.forEach((value, key) => {
        boostsObject[key] = value;
      });

      res.json({
        success: true,
        data: { boosts: boostsObject },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get adjusted weights for recommendations
   * GET /api/widget/feedback/weights
   */
  async getAdjustedWeights(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const concern = req.query.concern as string || 'general';
      const adjustments = await learningEngineService.getAdjustedWeights(req.widgetUser.id, concern);

      res.json({
        success: true,
        data: { adjustments },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get aggregated insights
   * GET /api/widget/feedback/insights
   */
  async getInsights(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const concern = req.query.concern as string | undefined;
      const insights = await learningEngineService.getAggregatedInsights(concern);

      res.json({
        success: true,
        data: { insights },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get store feedback summary (admin)
   * GET /api/widget/feedback/store-summary
   */
  async getStoreSummary(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const summary = await feedbackService.getStoreFeedbackSummary(req.widgetUser.storeId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recommendation performance metrics
   * GET /api/widget/feedback/performance
   */
  async getPerformance(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const days = parseInt(req.query.days as string) || 30;
      const performance = await learningEngineService.trackRecommendationPerformance(req.widgetUser.storeId, days);

      res.json({
        success: true,
        data: { performance },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new FeedbackController();
