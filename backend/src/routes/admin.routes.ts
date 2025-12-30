import { Router } from 'express';
import adminQueryController from '../controllers/admin-query.controller';
import { authenticate, authorize } from '../middleware/auth';

/**
 * Admin Routes
 * All routes require authentication and admin role
 */

const router = Router();

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(authorize('admin'));

// ============================================================================
// QUERY ANALYTICS ROUTES
// ============================================================================

/**
 * GET /api/admin/queries
 * Search and filter queries with pagination
 *
 * Query params:
 *   - storeId (required): UUID
 *   - startDate: ISO date
 *   - endDate: ISO date
 *   - category: string
 *   - searchTerm: string
 *   - sentiment: positive|neutral|negative
 *   - page: number (default: 1)
 *   - limit: number (default: 50)
 */
router.get('/queries', adminQueryController.searchQueries.bind(adminQueryController));

/**
 * GET /api/admin/queries/popular
 * Get most frequently asked queries
 *
 * Query params:
 *   - storeId (required): UUID
 *   - days: number (default: 30)
 *   - limit: number (default: 20)
 *   - category: string (optional filter)
 */
router.get('/queries/popular', adminQueryController.getPopularQueries.bind(adminQueryController));

/**
 * GET /api/admin/queries/categories
 * Get query breakdown by category with percentages
 *
 * Query params:
 *   - storeId (required): UUID
 *   - days: number (default: 30)
 */
router.get('/queries/categories', adminQueryController.getCategoryBreakdown.bind(adminQueryController));

/**
 * GET /api/admin/queries/stats
 * Get overall query statistics and metrics
 *
 * Query params:
 *   - storeId (required): UUID
 *   - days: number (default: 30)
 */
router.get('/queries/stats', adminQueryController.getQueryStats.bind(adminQueryController));

/**
 * GET /api/admin/queries/export
 * Export queries to CSV or JSON format
 *
 * Query params:
 *   - storeId (required): UUID
 *   - format: csv|json (default: csv)
 *   - startDate: ISO date
 *   - endDate: ISO date
 *   - category: string
 *   - searchTerm: string
 */
router.get('/queries/export', adminQueryController.exportQueries.bind(adminQueryController));

/**
 * GET /api/admin/queries/cache-stats
 * Get cache performance statistics
 *
 * Query params:
 *   - storeId (required): UUID
 *   - days: number (default: 30)
 */
router.get('/queries/cache-stats', adminQueryController.getCacheStats.bind(adminQueryController));

// ============================================================================
// CONVERSATION ROUTES
// ============================================================================

/**
 * GET /api/admin/conversations/:id
 * Get full conversation details with all messages
 *
 * Path params:
 *   - id: Conversation UUID
 * Query params:
 *   - storeId: UUID (for ownership verification)
 */
router.get('/conversations/:id', adminQueryController.getConversationDetails.bind(adminQueryController));

export default router;
