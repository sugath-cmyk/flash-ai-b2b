import { Response, NextFunction } from 'express';
import { WidgetAuthRequest } from '../middleware/widget-auth';
import safetyCheckerService from '../services/safety-checker.service';
import { createError } from '../middleware/errorHandler';

class SafetyController {
  /**
   * Analyze ingredient list for safety
   * POST /api/widget/safety/check
   */
  async checkIngredients(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const { ingredients, ingredientText, productName, brand } = req.body;

      // Accept either parsed ingredients array or raw text
      let parsedIngredients: string[];
      if (ingredients && Array.isArray(ingredients)) {
        parsedIngredients = ingredients;
      } else if (ingredientText && typeof ingredientText === 'string') {
        parsedIngredients = safetyCheckerService.parseIngredients(ingredientText);
      } else {
        throw createError('Either ingredients array or ingredientText is required', 400);
      }

      if (parsedIngredients.length === 0) {
        throw createError('No valid ingredients found', 400);
      }

      // Get user preferences and allergens if authenticated
      let userPreferences = null;
      let userAllergens = null;

      if (req.widgetUser) {
        userPreferences = await safetyCheckerService.getUserPreferences(req.widgetUser.id);
        userAllergens = await safetyCheckerService.getUserAllergens(req.widgetUser.id);
      }

      // Analyze ingredients
      const safetyReport = await safetyCheckerService.analyzeIngredients(
        parsedIngredients,
        userPreferences || undefined,
        userAllergens || undefined
      );

      // Save scan if user is authenticated
      let scanId = null;
      if (req.widgetUser) {
        scanId = await safetyCheckerService.saveSafetyScan({
          userId: req.widgetUser.id,
          storeId: req.widgetUser.storeId,
          scanType: 'text_input',
          productName,
          brand,
          ingredientsRaw: ingredientText || ingredients.join(', '),
          ingredientsParsed: parsedIngredients,
          safetyReport,
        });
      }

      res.json({
        success: true,
        data: {
          scanId,
          ingredientCount: parsedIngredients.length,
          ingredients: parsedIngredients,
          report: safetyReport,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user safety preferences
   * GET /api/widget/safety/preferences
   */
  async getPreferences(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const preferences = await safetyCheckerService.getUserPreferences(req.widgetUser.id);

      res.json({
        success: true,
        data: {
          preferences: preferences || {
            isPregnant: false,
            isBreastfeeding: false,
            avoidFragrance: false,
            avoidAlcohol: false,
            avoidParabens: false,
            avoidSulfates: false,
            sensitivityLevel: 'normal',
            skinConditions: [],
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user safety preferences
   * PUT /api/widget/safety/preferences
   */
  async updatePreferences(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const {
        isPregnant,
        isBreastfeeding,
        avoidFragrance,
        avoidAlcohol,
        avoidParabens,
        avoidSulfates,
        sensitivityLevel,
        skinConditions,
      } = req.body;

      // Validate sensitivity level
      if (sensitivityLevel && !['normal', 'sensitive', 'very_sensitive'].includes(sensitivityLevel)) {
        throw createError('sensitivityLevel must be normal, sensitive, or very_sensitive', 400);
      }

      const preferences = await safetyCheckerService.updateUserPreferences(req.widgetUser.id, {
        isPregnant,
        isBreastfeeding,
        avoidFragrance,
        avoidAlcohol,
        avoidParabens,
        avoidSulfates,
        sensitivityLevel,
        skinConditions,
      });

      res.json({
        success: true,
        data: { preferences },
        message: 'Safety preferences updated',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user allergens
   * GET /api/widget/safety/allergens
   */
  async getAllergens(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const allergens = await safetyCheckerService.getUserAllergens(req.widgetUser.id);

      res.json({
        success: true,
        data: { allergens },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add user allergen
   * POST /api/widget/safety/allergens
   */
  async addAllergen(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { allergenType, allergenName, severity } = req.body;

      if (!allergenType) {
        throw createError('allergenType is required', 400);
      }

      if (severity && !['mild', 'moderate', 'severe'].includes(severity)) {
        throw createError('severity must be mild, moderate, or severe', 400);
      }

      const allergen = await safetyCheckerService.addUserAllergen(req.widgetUser.id, {
        allergenType,
        allergenName,
        severity,
      });

      res.status(201).json({
        success: true,
        data: { allergen },
        message: 'Allergen added',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove user allergen
   * DELETE /api/widget/safety/allergens/:allergenId
   */
  async removeAllergen(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { allergenId } = req.params;
      await safetyCheckerService.removeUserAllergen(req.widgetUser.id, allergenId);

      res.json({
        success: true,
        message: 'Allergen removed',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get common allergens list
   * GET /api/widget/safety/common-allergens
   */
  async getCommonAllergens(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const commonAllergens = safetyCheckerService.getCommonAllergens();

      res.json({
        success: true,
        data: { allergens: commonAllergens },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's scan history
   * GET /api/widget/safety/history
   */
  async getScanHistory(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const history = await safetyCheckerService.getUserScanHistory(req.widgetUser.id, limit);

      res.json({
        success: true,
        data: { scans: history },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific scan by ID
   * GET /api/widget/safety/scans/:scanId
   */
  async getScanById(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.widgetUser) {
        throw createError('Not authenticated', 401);
      }

      const { scanId } = req.params;
      const scan = await safetyCheckerService.getScanById(scanId, req.widgetUser.id);

      if (!scan) {
        throw createError('Scan not found', 404);
      }

      res.json({
        success: true,
        data: { scan },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Quick safety check (no auth required, no saving)
   * POST /api/widget/safety/quick-check
   */
  async quickCheck(req: WidgetAuthRequest, res: Response, next: NextFunction) {
    try {
      const { ingredientText } = req.body;

      if (!ingredientText || typeof ingredientText !== 'string') {
        throw createError('ingredientText is required', 400);
      }

      const parsedIngredients = safetyCheckerService.parseIngredients(ingredientText);

      if (parsedIngredients.length === 0) {
        throw createError('No valid ingredients found', 400);
      }

      // Basic analysis without user preferences
      const safetyReport = await safetyCheckerService.analyzeIngredients(parsedIngredients);

      res.json({
        success: true,
        data: {
          ingredientCount: parsedIngredients.length,
          overallSafety: safetyReport.overallSafety,
          score: safetyReport.score,
          flagCount: safetyReport.flags.length,
          conflictCount: safetyReport.conflicts.length,
          pregnancyWarningCount: safetyReport.pregnancyWarnings.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new SafetyController();
