import { Response, NextFunction } from 'express';
import { WidgetAuthRequest } from '../middleware/widget-auth';
import skincareKnowledgeService from '../services/skincare-knowledge.service';
import { createError } from '../middleware/errorHandler';

class KnowledgeController {
  /**
   * Search knowledge base
   * GET /api/widget/knowledge/search
   */
  async search(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 5;

      if (!query || query.length < 2) {
        throw createError('Search query must be at least 2 characters', 400);
      }

      const results = await skincareKnowledgeService.searchKnowledge(query, limit);

      res.json({
        success: true,
        data: {
          query,
          results: results.map(r => ({
            ...r.article,
            relevanceScore: r.relevanceScore,
            matchedKeywords: r.matchedKeywords,
          })),
          total: results.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all categories
   * GET /api/widget/knowledge/categories
   */
  async getCategories(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const categories = await skincareKnowledgeService.getCategories();

      res.json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get articles by category
   * GET /api/widget/knowledge/category/:category
   */
  async getByCategory(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const { category } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      const articles = await skincareKnowledgeService.getByCategory(category, limit);

      res.json({
        success: true,
        data: { category, articles, total: articles.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get articles by concern
   * GET /api/widget/knowledge/concern/:concern
   */
  async getByConcern(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const { concern } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const articles = await skincareKnowledgeService.getByConcern(concern, limit);

      res.json({
        success: true,
        data: { concern, articles, total: articles.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get articles by ingredient
   * GET /api/widget/knowledge/ingredient/:ingredient
   */
  async getByIngredient(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const { ingredient } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const articles = await skincareKnowledgeService.getByIngredient(ingredient, limit);

      res.json({
        success: true,
        data: { ingredient, articles, total: articles.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get article by ID
   * GET /api/widget/knowledge/articles/:id
   */
  async getById(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const article = await skincareKnowledgeService.getById(id);

      if (!article) {
        throw createError('Article not found', 404);
      }

      res.json({
        success: true,
        data: { article },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get popular articles
   * GET /api/widget/knowledge/popular
   */
  async getPopular(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const articles = await skincareKnowledgeService.getPopular(limit);

      res.json({
        success: true,
        data: { articles },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark article as helpful
   * POST /api/widget/knowledge/articles/:id/helpful
   */
  async markHelpful(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      await skincareKnowledgeService.markHelpful(id);

      res.json({
        success: true,
        message: 'Marked as helpful',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Seed the knowledge base (admin only)
   * POST /api/widget/knowledge/seed
   */
  async seedKnowledgeBase(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const count = await skincareKnowledgeService.seedKnowledgeBase();

      res.json({
        success: true,
        message: `Seeded ${count} knowledge articles`,
        data: { articlesSeeded: count },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new KnowledgeController();
