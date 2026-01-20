import { pool } from '../config/database';
import { INGREDIENTS_DATABASE, IngredientData } from './recommendation-engine';

// Types
interface SafetyFlag {
  ingredient: string;
  matchedKey: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  recommendation: string;
}

interface IngredientConflict {
  ingredient1: string;
  ingredient2: string;
  severity: 'moderate' | 'severe';
  explanation: string;
}

interface SafetyReport {
  overallSafety: 'safe' | 'caution' | 'warning' | 'avoid';
  score: number; // 0-100, higher is safer
  flags: SafetyFlag[];
  conflicts: IngredientConflict[];
  pregnancyWarnings: string[];
  sensitivityWarnings: string[];
  personalizedWarnings: string[]; // Based on user preferences
  safeIngredients: string[];
  unknownIngredients: string[];
  recommendations: string[];
}

interface UserSafetyPreferences {
  isPregnant: boolean;
  isBreastfeeding: boolean;
  avoidFragrance: boolean;
  avoidAlcohol: boolean;
  avoidParabens: boolean;
  avoidSulfates: boolean;
  sensitivityLevel: 'normal' | 'sensitive' | 'very_sensitive';
  skinConditions: string[];
}

interface UserAllergen {
  id: string;
  allergenType: string;
  allergenName: string;
  severity: 'mild' | 'moderate' | 'severe';
}

// Extended ingredient patterns for safety checking
const SAFETY_PATTERNS: Record<string, {
  pattern: RegExp;
  category: string;
  pregnancySafe: boolean;
  sensitivityRisk: 'low' | 'medium' | 'high';
  concerns: string[];
}> = {
  retinoid: {
    pattern: /\b(retino|retin-a|tretinoin|adapalene|tazarotene|retinaldehyde)\b/i,
    category: 'retinoid',
    pregnancySafe: false,
    sensitivityRisk: 'high',
    concerns: ['Not safe during pregnancy', 'Can cause irritation and peeling'],
  },
  hydroquinone: {
    pattern: /\bhydroquinone\b/i,
    category: 'skin_lightener',
    pregnancySafe: false,
    sensitivityRisk: 'high',
    concerns: ['Not recommended during pregnancy', 'Can cause ochronosis with prolonged use'],
  },
  salicylic_acid: {
    pattern: /\b(salicylic|beta.?hydroxy|bha)\b/i,
    category: 'exfoliant',
    pregnancySafe: false,
    sensitivityRisk: 'medium',
    concerns: ['Avoid high concentrations during pregnancy'],
  },
  benzoyl_peroxide: {
    pattern: /\bbenzoyl.?peroxide\b/i,
    category: 'acne_treatment',
    pregnancySafe: true,
    sensitivityRisk: 'high',
    concerns: ['Can cause dryness and irritation', 'May bleach fabrics'],
  },
  fragrance: {
    pattern: /\b(fragrance|parfum|perfume|aroma)\b/i,
    category: 'fragrance',
    pregnancySafe: true,
    sensitivityRisk: 'medium',
    concerns: ['Common allergen', 'Can irritate sensitive skin'],
  },
  alcohol: {
    pattern: /\b(alcohol denat|sd alcohol|isopropyl alcohol|ethanol)(?!\s*fatty)\b/i,
    category: 'alcohol',
    pregnancySafe: true,
    sensitivityRisk: 'medium',
    concerns: ['Can be drying', 'May irritate sensitive skin'],
  },
  paraben: {
    pattern: /\b(\w*paraben)\b/i,
    category: 'preservative',
    pregnancySafe: true,
    sensitivityRisk: 'low',
    concerns: ['Some prefer to avoid due to controversy'],
  },
  sulfate: {
    pattern: /\b(sodium lauryl sulfate|sodium laureth sulfate|sls|sles)\b/i,
    category: 'surfactant',
    pregnancySafe: true,
    sensitivityRisk: 'medium',
    concerns: ['Can be stripping and irritating'],
  },
  formaldehyde: {
    pattern: /\b(formaldehyde|formalin|dmdm hydantoin|imidazolidinyl urea|diazolidinyl urea|quaternium-15)\b/i,
    category: 'preservative',
    pregnancySafe: false,
    sensitivityRisk: 'high',
    concerns: ['Known irritant', 'Potential carcinogen'],
  },
  essential_oil: {
    pattern: /\b(essential oil|tea tree|eucalyptus|peppermint|lavender|citrus)\s*(oil)?\b/i,
    category: 'essential_oil',
    pregnancySafe: false,
    sensitivityRisk: 'medium',
    concerns: ['Some essential oils not safe during pregnancy', 'Can cause photosensitivity'],
  },
  vitamin_a: {
    pattern: /\b(vitamin a|retinyl palmitate|retinyl acetate)\b/i,
    category: 'vitamin_a',
    pregnancySafe: false,
    sensitivityRisk: 'medium',
    concerns: ['High doses not safe during pregnancy'],
  },
  aha: {
    pattern: /\b(glycolic|lactic|mandelic|tartaric|citric|malic)\s*(acid)?\b/i,
    category: 'exfoliant',
    pregnancySafe: true,
    sensitivityRisk: 'medium',
    concerns: ['Increases sun sensitivity', 'Can cause irritation'],
  },
  chemical_sunscreen: {
    pattern: /\b(oxybenzone|avobenzone|octinoxate|octisalate|octocrylene|homosalate)\b/i,
    category: 'sunscreen',
    pregnancySafe: true,
    sensitivityRisk: 'low',
    concerns: ['Some prefer mineral alternatives', 'Potential hormone disruptors'],
  },
};

class SafetyCheckerService {
  private readonly DEMO_STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

  private normalizeStoreId(storeId: string): string {
    if (storeId === 'demo-store' || storeId === 'demo_store') {
      return this.DEMO_STORE_ID;
    }
    return storeId;
  }

  /**
   * Parse ingredient list from text
   */
  parseIngredients(ingredientText: string): string[] {
    // Clean and split by common separators
    const cleaned = ingredientText
      .replace(/\n/g, ',')
      .replace(/\s*[•·]\s*/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned
      .split(/,(?![^()]*\))/) // Split by comma but not within parentheses
      .map(i => i.trim())
      .filter(i => i.length > 0 && i.length < 100); // Filter out empty and overly long items
  }

  /**
   * Match ingredient to known database
   */
  matchIngredient(ingredient: string): { key: string; data: IngredientData } | null {
    const normalized = ingredient.toLowerCase().trim();

    // Direct match
    for (const [key, data] of Object.entries(INGREDIENTS_DATABASE)) {
      const keyNormalized = key.toLowerCase().replace(/_/g, ' ');
      if (normalized.includes(keyNormalized) || keyNormalized.includes(normalized)) {
        return { key, data };
      }
    }

    // Pattern match
    for (const [key, pattern] of Object.entries(SAFETY_PATTERNS)) {
      if (pattern.pattern.test(ingredient)) {
        // Create synthetic IngredientData from pattern
        return {
          key,
          data: {
            name: key.replace(/_/g, ' '),
            aliases: [],
            category: pattern.category,
            benefits: [],
            concerns: pattern.concerns,
            skinTypes: [],
            concentration: { min: 0, max: 100, optimal: 50 },
            ph: { min: 0, max: 14 },
            timeOfUse: 'both',
            photosensitive: false,
            pregnancySafe: pattern.pregnancySafe,
            sensitivityRisk: pattern.sensitivityRisk,
            synergies: [],
            conflicts: [],
            ageRange: { min: 0, max: 100 },
          } as IngredientData,
        };
      }
    }

    return null;
  }

  /**
   * Analyze ingredients for safety
   */
  async analyzeIngredients(
    ingredients: string[],
    userPreferences?: UserSafetyPreferences,
    userAllergens?: UserAllergen[]
  ): Promise<SafetyReport> {
    const flags: SafetyFlag[] = [];
    const conflicts: IngredientConflict[] = [];
    const pregnancyWarnings: string[] = [];
    const sensitivityWarnings: string[] = [];
    const personalizedWarnings: string[] = [];
    const safeIngredients: string[] = [];
    const unknownIngredients: string[] = [];
    const recommendations: string[] = [];

    const matchedIngredients: Map<string, IngredientData> = new Map();

    // Analyze each ingredient
    for (const ingredient of ingredients) {
      const match = this.matchIngredient(ingredient);

      if (match) {
        matchedIngredients.set(match.key, match.data);

        // Check pregnancy safety
        if (!match.data.pregnancySafe) {
          pregnancyWarnings.push(`${ingredient}: Not recommended during pregnancy`);

          if (userPreferences?.isPregnant || userPreferences?.isBreastfeeding) {
            flags.push({
              ingredient,
              matchedKey: match.key,
              severity: 'critical',
              reason: 'Not safe during pregnancy/breastfeeding',
              recommendation: 'Avoid this product or consult your doctor',
            });
          }
        }

        // Check sensitivity risk
        if (match.data.sensitivityRisk === 'high') {
          sensitivityWarnings.push(`${ingredient}: High sensitivity risk`);

          if (userPreferences?.sensitivityLevel === 'very_sensitive') {
            flags.push({
              ingredient,
              matchedKey: match.key,
              severity: 'high',
              reason: 'High sensitivity risk ingredient',
              recommendation: 'Patch test before use or avoid if prone to reactions',
            });
          } else if (userPreferences?.sensitivityLevel === 'sensitive') {
            flags.push({
              ingredient,
              matchedKey: match.key,
              severity: 'medium',
              reason: 'May cause sensitivity',
              recommendation: 'Patch test recommended',
            });
          }
        } else if (match.data.sensitivityRisk === 'medium' && userPreferences?.sensitivityLevel === 'very_sensitive') {
          flags.push({
            ingredient,
            matchedKey: match.key,
            severity: 'medium',
            reason: 'Moderate sensitivity risk for very sensitive skin',
            recommendation: 'Use with caution',
          });
        }

        // Check user preferences
        if (userPreferences) {
          // Fragrance
          if (userPreferences.avoidFragrance && SAFETY_PATTERNS.fragrance.pattern.test(ingredient)) {
            personalizedWarnings.push(`${ingredient}: Contains fragrance (you prefer to avoid)`);
            flags.push({
              ingredient,
              matchedKey: 'fragrance',
              severity: 'medium',
              reason: 'Contains fragrance',
              recommendation: 'You have indicated a preference to avoid fragrance',
            });
          }

          // Alcohol
          if (userPreferences.avoidAlcohol && SAFETY_PATTERNS.alcohol.pattern.test(ingredient)) {
            personalizedWarnings.push(`${ingredient}: Contains drying alcohol`);
            flags.push({
              ingredient,
              matchedKey: 'alcohol',
              severity: 'low',
              reason: 'Contains drying alcohol',
              recommendation: 'You have indicated a preference to avoid alcohol',
            });
          }

          // Parabens
          if (userPreferences.avoidParabens && SAFETY_PATTERNS.paraben.pattern.test(ingredient)) {
            personalizedWarnings.push(`${ingredient}: Contains parabens`);
            flags.push({
              ingredient,
              matchedKey: 'paraben',
              severity: 'low',
              reason: 'Contains parabens',
              recommendation: 'You have indicated a preference to avoid parabens',
            });
          }

          // Sulfates
          if (userPreferences.avoidSulfates && SAFETY_PATTERNS.sulfate.pattern.test(ingredient)) {
            personalizedWarnings.push(`${ingredient}: Contains sulfates`);
            flags.push({
              ingredient,
              matchedKey: 'sulfate',
              severity: 'low',
              reason: 'Contains sulfates',
              recommendation: 'You have indicated a preference to avoid sulfates',
            });
          }
        }

        // Check allergens
        if (userAllergens) {
          for (const allergen of userAllergens) {
            if (
              ingredient.toLowerCase().includes(allergen.allergenType.toLowerCase()) ||
              (allergen.allergenName && ingredient.toLowerCase().includes(allergen.allergenName.toLowerCase()))
            ) {
              const severity = allergen.severity === 'severe' ? 'critical' : allergen.severity === 'moderate' ? 'high' : 'medium';
              flags.push({
                ingredient,
                matchedKey: allergen.allergenType,
                severity,
                reason: `Matches your allergen: ${allergen.allergenName || allergen.allergenType}`,
                recommendation: allergen.severity === 'severe' ? 'Do not use this product' : 'Use with extreme caution',
              });
              personalizedWarnings.push(`${ingredient}: Potential allergen match`);
            }
          }
        }

        // Mark as safe if no issues
        if (!flags.some(f => f.ingredient === ingredient)) {
          safeIngredients.push(ingredient);
        }
      } else {
        unknownIngredients.push(ingredient);
      }
    }

    // Check for conflicts between ingredients
    const matchedKeys = Array.from(matchedIngredients.keys());
    for (let i = 0; i < matchedKeys.length; i++) {
      const key1 = matchedKeys[i];
      const data1 = matchedIngredients.get(key1)!;

      for (let j = i + 1; j < matchedKeys.length; j++) {
        const key2 = matchedKeys[j];

        if (data1.conflicts.includes(key2)) {
          conflicts.push({
            ingredient1: key1,
            ingredient2: key2,
            severity: 'moderate',
            explanation: `${key1} and ${key2} may interact negatively when used together`,
          });
        }
      }
    }

    // Calculate overall safety score
    let score = 100;
    for (const flag of flags) {
      switch (flag.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 8; break;
        case 'low': score -= 3; break;
      }
    }
    for (const conflict of conflicts) {
      score -= conflict.severity === 'severe' ? 15 : 8;
    }
    score = Math.max(0, score);

    // Determine overall safety rating
    let overallSafety: 'safe' | 'caution' | 'warning' | 'avoid';
    if (flags.some(f => f.severity === 'critical')) {
      overallSafety = 'avoid';
    } else if (score < 50 || flags.some(f => f.severity === 'high')) {
      overallSafety = 'warning';
    } else if (score < 80 || flags.length > 0) {
      overallSafety = 'caution';
    } else {
      overallSafety = 'safe';
    }

    // Generate recommendations
    if (conflicts.length > 0) {
      recommendations.push('Consider using conflicting ingredients at different times (AM/PM)');
    }
    if (flags.some(f => f.matchedKey === 'aha' || f.matchedKey === 'retinoid')) {
      recommendations.push('Always use sunscreen when using exfoliating or retinoid products');
    }
    if (userPreferences?.isPregnant && pregnancyWarnings.length > 0) {
      recommendations.push('Consult your healthcare provider before using this product');
    }
    if (unknownIngredients.length > ingredients.length / 2) {
      recommendations.push('Many ingredients could not be analyzed - verify with manufacturer');
    }

    return {
      overallSafety,
      score,
      flags,
      conflicts,
      pregnancyWarnings,
      sensitivityWarnings,
      personalizedWarnings,
      safeIngredients,
      unknownIngredients,
      recommendations,
    };
  }

  /**
   * Get user safety preferences
   */
  async getUserPreferences(userId: string): Promise<UserSafetyPreferences | null> {
    const result = await pool.query(
      `SELECT * FROM user_safety_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      isPregnant: row.is_pregnant,
      isBreastfeeding: row.is_breastfeeding,
      avoidFragrance: row.avoid_fragrance,
      avoidAlcohol: row.avoid_alcohol,
      avoidParabens: row.avoid_parabens,
      avoidSulfates: row.avoid_sulfates,
      sensitivityLevel: row.sensitivity_level,
      skinConditions: row.skin_conditions || [],
    };
  }

  /**
   * Update user safety preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserSafetyPreferences>): Promise<UserSafetyPreferences> {
    const result = await pool.query(
      `INSERT INTO user_safety_preferences (
        user_id, is_pregnant, is_breastfeeding, avoid_fragrance, avoid_alcohol,
        avoid_parabens, avoid_sulfates, sensitivity_level, skin_conditions, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        is_pregnant = COALESCE($2, user_safety_preferences.is_pregnant),
        is_breastfeeding = COALESCE($3, user_safety_preferences.is_breastfeeding),
        avoid_fragrance = COALESCE($4, user_safety_preferences.avoid_fragrance),
        avoid_alcohol = COALESCE($5, user_safety_preferences.avoid_alcohol),
        avoid_parabens = COALESCE($6, user_safety_preferences.avoid_parabens),
        avoid_sulfates = COALESCE($7, user_safety_preferences.avoid_sulfates),
        sensitivity_level = COALESCE($8, user_safety_preferences.sensitivity_level),
        skin_conditions = COALESCE($9, user_safety_preferences.skin_conditions),
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        preferences.isPregnant ?? false,
        preferences.isBreastfeeding ?? false,
        preferences.avoidFragrance ?? false,
        preferences.avoidAlcohol ?? false,
        preferences.avoidParabens ?? false,
        preferences.avoidSulfates ?? false,
        preferences.sensitivityLevel ?? 'normal',
        preferences.skinConditions || [],
      ]
    );

    const row = result.rows[0];
    return {
      isPregnant: row.is_pregnant,
      isBreastfeeding: row.is_breastfeeding,
      avoidFragrance: row.avoid_fragrance,
      avoidAlcohol: row.avoid_alcohol,
      avoidParabens: row.avoid_parabens,
      avoidSulfates: row.avoid_sulfates,
      sensitivityLevel: row.sensitivity_level,
      skinConditions: row.skin_conditions || [],
    };
  }

  /**
   * Get user allergens
   */
  async getUserAllergens(userId: string): Promise<UserAllergen[]> {
    const result = await pool.query(
      `SELECT * FROM user_allergens WHERE user_id = $1 ORDER BY severity DESC`,
      [userId]
    );

    return result.rows.map((row: { id: string; allergen_type: string; allergen_name: string; severity: string }) => ({
      id: row.id,
      allergenType: row.allergen_type,
      allergenName: row.allergen_name,
      severity: row.severity as 'mild' | 'moderate' | 'severe',
    }));
  }

  /**
   * Add user allergen
   */
  async addUserAllergen(userId: string, allergen: {
    allergenType: string;
    allergenName?: string;
    severity?: 'mild' | 'moderate' | 'severe';
  }): Promise<UserAllergen> {
    const result = await pool.query(
      `INSERT INTO user_allergens (user_id, allergen_type, allergen_name, severity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, allergen_type) DO UPDATE SET
         allergen_name = COALESCE($3, user_allergens.allergen_name),
         severity = COALESCE($4, user_allergens.severity)
       RETURNING *`,
      [userId, allergen.allergenType, allergen.allergenName || null, allergen.severity || 'moderate']
    );

    const row = result.rows[0];
    return {
      id: row.id,
      allergenType: row.allergen_type,
      allergenName: row.allergen_name,
      severity: row.severity,
    };
  }

  /**
   * Remove user allergen
   */
  async removeUserAllergen(userId: string, allergenId: string): Promise<void> {
    await pool.query(
      `DELETE FROM user_allergens WHERE id = $1 AND user_id = $2`,
      [allergenId, userId]
    );
  }

  /**
   * Save a product safety scan
   */
  async saveSafetyScan(params: {
    userId?: string;
    visitorId?: string;
    storeId: string;
    scanType: 'barcode' | 'text_input' | 'image_ocr';
    productName?: string;
    brand?: string;
    ingredientsRaw: string;
    ingredientsParsed: string[];
    safetyReport: SafetyReport;
  }): Promise<string> {
    const storeId = this.normalizeStoreId(params.storeId);

    const result = await pool.query(
      `INSERT INTO product_safety_scans (
        user_id, visitor_id, store_id, scan_type, product_name, brand,
        ingredients_raw, ingredients_parsed, safety_report, overall_safety, flagged_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        params.userId || null,
        params.visitorId || null,
        storeId,
        params.scanType,
        params.productName || null,
        params.brand || null,
        params.ingredientsRaw,
        params.ingredientsParsed,
        JSON.stringify(params.safetyReport),
        params.safetyReport.overallSafety,
        params.safetyReport.flags.length,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Get user's safety scan history
   */
  async getUserScanHistory(userId: string, limit: number = 20): Promise<Array<{
    id: string;
    scanType: string;
    productName: string | null;
    brand: string | null;
    overallSafety: string;
    flaggedCount: number;
    createdAt: Date;
  }>> {
    const result = await pool.query(
      `SELECT id, scan_type, product_name, brand, overall_safety, flagged_count, created_at
       FROM product_safety_scans
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row: {
      id: string;
      scan_type: string;
      product_name: string | null;
      brand: string | null;
      overall_safety: string;
      flagged_count: number;
      created_at: Date;
    }) => ({
      id: row.id,
      scanType: row.scan_type,
      productName: row.product_name,
      brand: row.brand,
      overallSafety: row.overall_safety,
      flaggedCount: row.flagged_count,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get a specific safety scan by ID
   */
  async getScanById(scanId: string, userId: string): Promise<{
    id: string;
    scanType: string;
    productName: string | null;
    brand: string | null;
    ingredientsRaw: string;
    ingredientsParsed: string[];
    safetyReport: SafetyReport;
    createdAt: Date;
  } | null> {
    const result = await pool.query(
      `SELECT * FROM product_safety_scans WHERE id = $1 AND user_id = $2`,
      [scanId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      scanType: row.scan_type,
      productName: row.product_name,
      brand: row.brand,
      ingredientsRaw: row.ingredients_raw,
      ingredientsParsed: row.ingredients_parsed,
      safetyReport: row.safety_report,
      createdAt: row.created_at,
    };
  }

  /**
   * Get common allergens list for UI
   */
  getCommonAllergens(): Array<{ type: string; name: string; description: string }> {
    return [
      { type: 'fragrance', name: 'Fragrance/Parfum', description: 'Synthetic or natural scents' },
      { type: 'nuts', name: 'Tree Nuts', description: 'Almond, walnut, macadamia oils' },
      { type: 'gluten', name: 'Gluten', description: 'Wheat-derived ingredients' },
      { type: 'soy', name: 'Soy', description: 'Soybean-derived ingredients' },
      { type: 'lanolin', name: 'Lanolin', description: 'Wool-derived moisturizer' },
      { type: 'propylene_glycol', name: 'Propylene Glycol', description: 'Common humectant' },
      { type: 'formaldehyde', name: 'Formaldehyde Releasers', description: 'DMDM hydantoin, quaternium-15' },
      { type: 'essential_oils', name: 'Essential Oils', description: 'Concentrated plant extracts' },
      { type: 'latex', name: 'Latex', description: 'Rubber-derived ingredients' },
      { type: 'nickel', name: 'Nickel', description: 'Metal found in some cosmetics' },
      { type: 'cobalt', name: 'Cobalt', description: 'Metal colorant' },
      { type: 'balsam_peru', name: 'Balsam of Peru', description: 'Common fragrance allergen' },
    ];
  }
}

export default new SafetyCheckerService();
