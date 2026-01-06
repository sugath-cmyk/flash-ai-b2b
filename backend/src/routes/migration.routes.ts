import { Router } from 'express';
import migrationController from '../controllers/migration.controller';

const router = Router();

/**
 * Migration Routes
 * These endpoints allow running database migrations via API
 */

// GET /api/migrate/status - Check if migration has been run (public)
router.get('/status', migrationController.getMigrationStatus.bind(migrationController));

// POST /api/migrate/run-discounts-migration - Run the discounts migration (requires admin secret)
router.post('/run-discounts-migration', migrationController.runDiscountsMigration.bind(migrationController));

export default router;
