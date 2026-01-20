import { Router } from 'express';
import knowledgeController from '../controllers/knowledge.controller';

const router = Router();

// All knowledge endpoints are public (no auth required)

// GET /api/widget/knowledge/search - Search knowledge base
router.get('/search', knowledgeController.search.bind(knowledgeController));

// GET /api/widget/knowledge/categories - Get all categories
router.get('/categories', knowledgeController.getCategories.bind(knowledgeController));

// GET /api/widget/knowledge/popular - Get popular articles
router.get('/popular', knowledgeController.getPopular.bind(knowledgeController));

// GET /api/widget/knowledge/category/:category - Get articles by category
router.get('/category/:category', knowledgeController.getByCategory.bind(knowledgeController));

// GET /api/widget/knowledge/concern/:concern - Get articles by concern
router.get('/concern/:concern', knowledgeController.getByConcern.bind(knowledgeController));

// GET /api/widget/knowledge/ingredient/:ingredient - Get articles by ingredient
router.get('/ingredient/:ingredient', knowledgeController.getByIngredient.bind(knowledgeController));

// GET /api/widget/knowledge/articles/:id - Get article by ID
router.get('/articles/:id', knowledgeController.getById.bind(knowledgeController));

// POST /api/widget/knowledge/articles/:id/helpful - Mark article as helpful
router.post('/articles/:id/helpful', knowledgeController.markHelpful.bind(knowledgeController));

// POST /api/widget/knowledge/seed - Seed knowledge base (admin)
router.post('/seed', knowledgeController.seedKnowledgeBase.bind(knowledgeController));

export default router;
