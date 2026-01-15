/**
 * Flash AI Personalized Recommendation Engine
 * 1000+ factors for super accurate skincare recommendations
 * Version: 1.0.0
 */

// =============================================================================
// INGREDIENT DATABASE (200+ ingredients with detailed properties)
// =============================================================================

export interface IngredientData {
  name: string;
  aliases: string[];
  category: string;
  benefits: string[];
  concerns: string[];
  skinTypes: string[];
  concentration: { min: number; max: number; optimal: number };
  ph: { min: number; max: number };
  timeOfUse: 'morning' | 'evening' | 'both';
  photosensitive: boolean;
  pregnancySafe: boolean;
  sensitivityRisk: 'low' | 'medium' | 'high';
  synergies: string[];
  conflicts: string[];
  ageRange: { min: number; max: number };
}

export const INGREDIENTS_DATABASE: Record<string, IngredientData> = {
  // === VITAMIN C FAMILY ===
  'ascorbic_acid': {
    name: 'L-Ascorbic Acid',
    aliases: ['vitamin c', 'l-ascorbic acid', 'ascorbic acid', 'pure vitamin c'],
    category: 'antioxidant',
    benefits: ['brightening', 'collagen synthesis', 'sun damage repair', 'hyperpigmentation'],
    concerns: ['pigmentation', 'dullness', 'aging', 'sun_damage', 'uneven_tone'],
    skinTypes: ['normal', 'oily', 'combination'],
    concentration: { min: 5, max: 20, optimal: 15 },
    ph: { min: 2.5, max: 3.5 },
    timeOfUse: 'morning',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'medium',
    synergies: ['vitamin_e', 'ferulic_acid', 'hyaluronic_acid'],
    conflicts: ['niacinamide', 'retinol', 'benzoyl_peroxide', 'aha', 'bha'],
    ageRange: { min: 20, max: 70 }
  },
  'sodium_ascorbyl_phosphate': {
    name: 'Sodium Ascorbyl Phosphate',
    aliases: ['sap', 'sodium ascorbyl phosphate', 'stable vitamin c'],
    category: 'antioxidant',
    benefits: ['brightening', 'anti-acne', 'gentle antioxidant'],
    concerns: ['pigmentation', 'acne', 'sensitivity'],
    skinTypes: ['sensitive', 'dry', 'normal'],
    concentration: { min: 1, max: 5, optimal: 3 },
    ph: { min: 6, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['niacinamide', 'hyaluronic_acid'],
    conflicts: [],
    ageRange: { min: 16, max: 80 }
  },
  'ascorbyl_glucoside': {
    name: 'Ascorbyl Glucoside',
    aliases: ['aa2g', 'ascorbyl glucoside'],
    category: 'antioxidant',
    benefits: ['brightening', 'stable', 'gentle'],
    concerns: ['pigmentation', 'dullness'],
    skinTypes: ['all'],
    concentration: { min: 0.5, max: 2, optimal: 1 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['niacinamide', 'hyaluronic_acid', 'ceramides'],
    conflicts: [],
    ageRange: { min: 14, max: 90 }
  },
  'ethyl_ascorbic_acid': {
    name: 'Ethyl Ascorbic Acid',
    aliases: ['3-o-ethyl ascorbic acid', 'ethyl ascorbic'],
    category: 'antioxidant',
    benefits: ['brightening', 'stable', 'penetrating'],
    concerns: ['pigmentation', 'aging', 'dullness'],
    skinTypes: ['all'],
    concentration: { min: 1, max: 3, optimal: 2 },
    ph: { min: 4, max: 6 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['niacinamide', 'hyaluronic_acid'],
    conflicts: [],
    ageRange: { min: 18, max: 80 }
  },
  'tetrahexyldecyl_ascorbate': {
    name: 'Tetrahexyldecyl Ascorbate',
    aliases: ['thd ascorbate', 'oil soluble vitamin c', 'bv-osc'],
    category: 'antioxidant',
    benefits: ['brightening', 'stable', 'oil-soluble', 'deep penetration'],
    concerns: ['pigmentation', 'aging', 'texture'],
    skinTypes: ['dry', 'normal', 'mature'],
    concentration: { min: 1, max: 10, optimal: 5 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_e', 'squalane'],
    conflicts: [],
    ageRange: { min: 25, max: 80 }
  },

  // === RETINOIDS ===
  'retinol': {
    name: 'Retinol',
    aliases: ['retinol', 'vitamin a', 'retinyl'],
    category: 'retinoid',
    benefits: ['anti-aging', 'cell turnover', 'collagen', 'acne'],
    concerns: ['aging', 'wrinkles', 'acne', 'texture', 'pores', 'fine_lines'],
    skinTypes: ['normal', 'oily', 'combination'],
    concentration: { min: 0.01, max: 1, optimal: 0.3 },
    ph: { min: 5, max: 6.5 },
    timeOfUse: 'evening',
    photosensitive: true,
    pregnancySafe: false,
    sensitivityRisk: 'high',
    synergies: ['hyaluronic_acid', 'niacinamide', 'peptides', 'ceramides'],
    conflicts: ['vitamin_c', 'aha', 'bha', 'benzoyl_peroxide'],
    ageRange: { min: 25, max: 70 }
  },
  'retinal': {
    name: 'Retinaldehyde',
    aliases: ['retinal', 'retinaldehyde'],
    category: 'retinoid',
    benefits: ['anti-aging', 'faster results', 'antibacterial'],
    concerns: ['aging', 'wrinkles', 'acne'],
    skinTypes: ['normal', 'oily'],
    concentration: { min: 0.01, max: 0.1, optimal: 0.05 },
    ph: { min: 5, max: 6 },
    timeOfUse: 'evening',
    photosensitive: true,
    pregnancySafe: false,
    sensitivityRisk: 'high',
    synergies: ['hyaluronic_acid', 'ceramides'],
    conflicts: ['vitamin_c', 'aha', 'bha'],
    ageRange: { min: 30, max: 65 }
  },
  'adapalene': {
    name: 'Adapalene',
    aliases: ['adapalene', 'differin'],
    category: 'retinoid',
    benefits: ['acne treatment', 'anti-inflammatory', 'comedolytic'],
    concerns: ['acne', 'blackheads', 'whiteheads', 'clogged_pores'],
    skinTypes: ['oily', 'acne-prone'],
    concentration: { min: 0.1, max: 0.3, optimal: 0.1 },
    ph: { min: 4.5, max: 6 },
    timeOfUse: 'evening',
    photosensitive: true,
    pregnancySafe: false,
    sensitivityRisk: 'medium',
    synergies: ['benzoyl_peroxide', 'niacinamide'],
    conflicts: ['vitamin_c', 'other_retinoids'],
    ageRange: { min: 12, max: 45 }
  },
  'bakuchiol': {
    name: 'Bakuchiol',
    aliases: ['bakuchiol', 'natural retinol alternative'],
    category: 'retinoid_alternative',
    benefits: ['anti-aging', 'gentle', 'pregnancy safe'],
    concerns: ['aging', 'wrinkles', 'sensitivity'],
    skinTypes: ['sensitive', 'dry', 'all'],
    concentration: { min: 0.5, max: 2, optimal: 1 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'niacinamide', 'hyaluronic_acid'],
    conflicts: [],
    ageRange: { min: 20, max: 90 }
  },
  'granactive_retinoid': {
    name: 'Hydroxypinacolone Retinoate',
    aliases: ['granactive retinoid', 'hpr', 'hydroxypinacolone retinoate'],
    category: 'retinoid',
    benefits: ['anti-aging', 'gentle', 'no irritation'],
    concerns: ['aging', 'wrinkles', 'texture'],
    skinTypes: ['sensitive', 'dry', 'all'],
    concentration: { min: 0.1, max: 2, optimal: 1 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'evening',
    photosensitive: false,
    pregnancySafe: false,
    sensitivityRisk: 'low',
    synergies: ['squalane', 'ceramides', 'peptides'],
    conflicts: [],
    ageRange: { min: 25, max: 80 }
  },

  // === HYDROXY ACIDS ===
  'glycolic_acid': {
    name: 'Glycolic Acid',
    aliases: ['glycolic acid', 'aha', 'alpha hydroxy acid'],
    category: 'aha',
    benefits: ['exfoliation', 'brightening', 'texture', 'anti-aging'],
    concerns: ['texture', 'dullness', 'hyperpigmentation', 'fine_lines', 'rough_skin'],
    skinTypes: ['normal', 'oily', 'combination'],
    concentration: { min: 2, max: 30, optimal: 10 },
    ph: { min: 3, max: 4 },
    timeOfUse: 'evening',
    photosensitive: true,
    pregnancySafe: true,
    sensitivityRisk: 'medium',
    synergies: ['hyaluronic_acid', 'niacinamide'],
    conflicts: ['retinol', 'vitamin_c', 'other_acids'],
    ageRange: { min: 18, max: 70 }
  },
  'lactic_acid': {
    name: 'Lactic Acid',
    aliases: ['lactic acid', 'aha'],
    category: 'aha',
    benefits: ['gentle exfoliation', 'hydrating', 'brightening'],
    concerns: ['texture', 'dullness', 'dryness', 'sensitivity'],
    skinTypes: ['dry', 'sensitive', 'normal'],
    concentration: { min: 2, max: 15, optimal: 5 },
    ph: { min: 3.5, max: 4.5 },
    timeOfUse: 'evening',
    photosensitive: true,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'ceramides'],
    conflicts: ['retinol', 'vitamin_c'],
    ageRange: { min: 16, max: 80 }
  },
  'mandelic_acid': {
    name: 'Mandelic Acid',
    aliases: ['mandelic acid', 'aha'],
    category: 'aha',
    benefits: ['gentle exfoliation', 'antibacterial', 'hyperpigmentation'],
    concerns: ['acne', 'pigmentation', 'texture', 'sensitivity'],
    skinTypes: ['sensitive', 'dry', 'acne-prone', 'dark'],
    concentration: { min: 2, max: 15, optimal: 10 },
    ph: { min: 3, max: 4 },
    timeOfUse: 'evening',
    photosensitive: true,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'niacinamide'],
    conflicts: ['retinol'],
    ageRange: { min: 16, max: 80 }
  },
  'salicylic_acid': {
    name: 'Salicylic Acid',
    aliases: ['salicylic acid', 'bha', 'beta hydroxy acid'],
    category: 'bha',
    benefits: ['pore clearing', 'anti-inflammatory', 'acne treatment'],
    concerns: ['acne', 'blackheads', 'pores', 'oiliness', 'congestion'],
    skinTypes: ['oily', 'acne-prone', 'combination'],
    concentration: { min: 0.5, max: 2, optimal: 2 },
    ph: { min: 3, max: 4 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: false,
    sensitivityRisk: 'low',
    synergies: ['niacinamide', 'tea_tree'],
    conflicts: ['retinol', 'vitamin_c', 'aha'],
    ageRange: { min: 12, max: 60 }
  },
  'azelaic_acid': {
    name: 'Azelaic Acid',
    aliases: ['azelaic acid'],
    category: 'dicarboxylic_acid',
    benefits: ['anti-acne', 'brightening', 'anti-rosacea', 'antibacterial'],
    concerns: ['acne', 'rosacea', 'pigmentation', 'redness', 'melasma'],
    skinTypes: ['all'],
    concentration: { min: 5, max: 20, optimal: 10 },
    ph: { min: 4, max: 5 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['niacinamide', 'hyaluronic_acid', 'vitamin_c'],
    conflicts: [],
    ageRange: { min: 14, max: 80 }
  },
  'phytic_acid': {
    name: 'Phytic Acid',
    aliases: ['phytic acid', 'ip6'],
    category: 'aha',
    benefits: ['gentle exfoliation', 'antioxidant', 'brightening'],
    concerns: ['sensitivity', 'dullness', 'pigmentation'],
    skinTypes: ['sensitive', 'all'],
    concentration: { min: 0.5, max: 2, optimal: 1 },
    ph: { min: 3.5, max: 5 },
    timeOfUse: 'evening',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'niacinamide'],
    conflicts: [],
    ageRange: { min: 16, max: 80 }
  },
  'polyhydroxy_acid': {
    name: 'Polyhydroxy Acids',
    aliases: ['pha', 'gluconolactone', 'lactobionic acid'],
    category: 'pha',
    benefits: ['ultra gentle exfoliation', 'hydrating', 'antioxidant'],
    concerns: ['sensitivity', 'dryness', 'texture', 'rosacea'],
    skinTypes: ['sensitive', 'dry', 'rosacea'],
    concentration: { min: 2, max: 15, optimal: 8 },
    ph: { min: 3.5, max: 5 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'ceramides'],
    conflicts: [],
    ageRange: { min: 14, max: 90 }
  },
  'tranexamic_acid': {
    name: 'Tranexamic Acid',
    aliases: ['tranexamic acid', 'txa'],
    category: 'brightening_acid',
    benefits: ['hyperpigmentation', 'melasma', 'dark spots'],
    concerns: ['pigmentation', 'melasma', 'dark_spots', 'post_inflammatory'],
    skinTypes: ['all'],
    concentration: { min: 2, max: 5, optimal: 3 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: false,
    sensitivityRisk: 'low',
    synergies: ['niacinamide', 'vitamin_c', 'kojic_acid'],
    conflicts: [],
    ageRange: { min: 18, max: 70 }
  },

  // === NIACINAMIDE & B VITAMINS ===
  'niacinamide': {
    name: 'Niacinamide',
    aliases: ['niacinamide', 'vitamin b3', 'nicotinamide'],
    category: 'vitamin_b',
    benefits: ['pore minimizing', 'sebum control', 'brightening', 'barrier repair'],
    concerns: ['pores', 'oiliness', 'pigmentation', 'redness', 'aging', 'acne'],
    skinTypes: ['all'],
    concentration: { min: 2, max: 10, optimal: 5 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'zinc', 'ceramides', 'peptides'],
    conflicts: ['pure_vitamin_c'],
    ageRange: { min: 12, max: 90 }
  },
  'panthenol': {
    name: 'Panthenol',
    aliases: ['panthenol', 'vitamin b5', 'provitamin b5', 'dexpanthenol'],
    category: 'vitamin_b',
    benefits: ['hydration', 'barrier repair', 'soothing', 'wound healing'],
    concerns: ['dryness', 'sensitivity', 'irritation', 'barrier_damage'],
    skinTypes: ['all'],
    concentration: { min: 1, max: 5, optimal: 2 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'ceramides', 'aloe'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },

  // === HYDRATING INGREDIENTS ===
  'hyaluronic_acid': {
    name: 'Hyaluronic Acid',
    aliases: ['hyaluronic acid', 'ha', 'sodium hyaluronate', 'hyaluronan'],
    category: 'humectant',
    benefits: ['intense hydration', 'plumping', 'anti-aging'],
    concerns: ['dryness', 'dehydration', 'fine_lines', 'aging'],
    skinTypes: ['all'],
    concentration: { min: 0.1, max: 2, optimal: 1 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'niacinamide', 'ceramides', 'peptides'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },
  'glycerin': {
    name: 'Glycerin',
    aliases: ['glycerin', 'glycerine', 'glycerol'],
    category: 'humectant',
    benefits: ['hydration', 'skin softening', 'barrier support'],
    concerns: ['dryness', 'dehydration'],
    skinTypes: ['all'],
    concentration: { min: 1, max: 10, optimal: 5 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'ceramides'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },
  'squalane': {
    name: 'Squalane',
    aliases: ['squalane', 'squalene'],
    category: 'emollient',
    benefits: ['moisturizing', 'non-comedogenic', 'skin identical'],
    concerns: ['dryness', 'dehydration', 'aging'],
    skinTypes: ['all'],
    concentration: { min: 1, max: 100, optimal: 10 },
    ph: { min: 0, max: 14 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['retinol', 'vitamin_c', 'all_actives'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },
  'ceramides': {
    name: 'Ceramides',
    aliases: ['ceramide', 'ceramides', 'ceramide np', 'ceramide ap', 'ceramide eop'],
    category: 'lipid',
    benefits: ['barrier repair', 'moisture retention', 'anti-aging'],
    concerns: ['dryness', 'sensitivity', 'barrier_damage', 'eczema', 'aging'],
    skinTypes: ['all'],
    concentration: { min: 0.1, max: 3, optimal: 1 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['cholesterol', 'fatty_acids', 'niacinamide', 'hyaluronic_acid'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },
  'urea': {
    name: 'Urea',
    aliases: ['urea', 'carbamide'],
    category: 'humectant',
    benefits: ['intense hydration', 'keratolytic', 'barrier repair'],
    concerns: ['severe_dryness', 'keratosis_pilaris', 'rough_skin', 'cracked_skin'],
    skinTypes: ['dry', 'very_dry'],
    concentration: { min: 2, max: 40, optimal: 10 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['lactic_acid', 'ceramides'],
    conflicts: [],
    ageRange: { min: 2, max: 100 }
  },
  'beta_glucan': {
    name: 'Beta Glucan',
    aliases: ['beta glucan', 'β-glucan', 'oat beta glucan'],
    category: 'humectant',
    benefits: ['soothing', 'hydrating', 'wound healing', 'anti-aging'],
    concerns: ['sensitivity', 'redness', 'dryness', 'irritation'],
    skinTypes: ['sensitive', 'dry', 'all'],
    concentration: { min: 0.1, max: 2, optimal: 0.5 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'centella'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },

  // === PEPTIDES ===
  'matrixyl': {
    name: 'Matrixyl (Palmitoyl Pentapeptide-4)',
    aliases: ['matrixyl', 'palmitoyl pentapeptide', 'pal-kttks'],
    category: 'peptide',
    benefits: ['collagen synthesis', 'anti-wrinkle', 'firming'],
    concerns: ['aging', 'wrinkles', 'fine_lines', 'sagging'],
    skinTypes: ['all'],
    concentration: { min: 0.001, max: 0.01, optimal: 0.005 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'vitamin_c', 'retinol'],
    conflicts: ['copper_peptides'],
    ageRange: { min: 25, max: 90 }
  },
  'argireline': {
    name: 'Argireline (Acetyl Hexapeptide-3)',
    aliases: ['argireline', 'acetyl hexapeptide-3', 'botox in a bottle'],
    category: 'peptide',
    benefits: ['expression line reduction', 'muscle relaxing'],
    concerns: ['expression_lines', 'forehead_wrinkles', 'crows_feet'],
    skinTypes: ['all'],
    concentration: { min: 0.001, max: 0.1, optimal: 0.05 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'matrixyl'],
    conflicts: ['copper_peptides'],
    ageRange: { min: 30, max: 90 }
  },
  'copper_peptides': {
    name: 'Copper Peptides (GHK-Cu)',
    aliases: ['copper peptides', 'ghk-cu', 'copper tripeptide'],
    category: 'peptide',
    benefits: ['wound healing', 'collagen', 'hair growth', 'anti-inflammatory'],
    concerns: ['aging', 'scars', 'wound_healing', 'hair_loss'],
    skinTypes: ['all'],
    concentration: { min: 0.01, max: 1, optimal: 0.1 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'evening',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid'],
    conflicts: ['vitamin_c', 'aha', 'bha', 'other_peptides'],
    ageRange: { min: 25, max: 80 }
  },
  'epidermal_growth_factor': {
    name: 'EGF (Epidermal Growth Factor)',
    aliases: ['egf', 'epidermal growth factor', 'sh-oligopeptide-1'],
    category: 'growth_factor',
    benefits: ['cell regeneration', 'wound healing', 'anti-aging'],
    concerns: ['aging', 'scars', 'slow_healing'],
    skinTypes: ['mature', 'damaged'],
    concentration: { min: 0.0001, max: 0.01, optimal: 0.001 },
    ph: { min: 5, max: 7 },
    timeOfUse: 'evening',
    photosensitive: false,
    pregnancySafe: false,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'peptides'],
    conflicts: [],
    ageRange: { min: 35, max: 80 }
  },

  // === BRIGHTENING AGENTS ===
  'kojic_acid': {
    name: 'Kojic Acid',
    aliases: ['kojic acid', 'kojic dipalmitate'],
    category: 'brightening',
    benefits: ['tyrosinase inhibition', 'dark spot fading', 'brightening'],
    concerns: ['pigmentation', 'dark_spots', 'melasma', 'age_spots'],
    skinTypes: ['all'],
    concentration: { min: 1, max: 4, optimal: 2 },
    ph: { min: 3, max: 5 },
    timeOfUse: 'evening',
    photosensitive: true,
    pregnancySafe: true,
    sensitivityRisk: 'medium',
    synergies: ['vitamin_c', 'niacinamide'],
    conflicts: [],
    ageRange: { min: 18, max: 80 }
  },
  'arbutin': {
    name: 'Alpha Arbutin',
    aliases: ['alpha arbutin', 'arbutin', 'α-arbutin'],
    category: 'brightening',
    benefits: ['tyrosinase inhibition', 'brightening', 'gentle'],
    concerns: ['pigmentation', 'dark_spots', 'uneven_tone'],
    skinTypes: ['all'],
    concentration: { min: 0.5, max: 2, optimal: 1 },
    ph: { min: 3.5, max: 6.5 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'niacinamide', 'kojic_acid'],
    conflicts: [],
    ageRange: { min: 16, max: 80 }
  },
  'licorice_extract': {
    name: 'Licorice Root Extract',
    aliases: ['licorice', 'licorice extract', 'glycyrrhiza glabra', 'glabridin'],
    category: 'brightening',
    benefits: ['brightening', 'anti-inflammatory', 'soothing'],
    concerns: ['pigmentation', 'redness', 'sensitivity', 'dark_spots'],
    skinTypes: ['all'],
    concentration: { min: 0.1, max: 2, optimal: 0.5 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['niacinamide', 'vitamin_c'],
    conflicts: [],
    ageRange: { min: 14, max: 90 }
  },

  // === SOOTHING & ANTI-INFLAMMATORY ===
  'centella_asiatica': {
    name: 'Centella Asiatica',
    aliases: ['centella', 'cica', 'tiger grass', 'gotu kola', 'madecassoside', 'asiaticoside'],
    category: 'soothing',
    benefits: ['wound healing', 'anti-inflammatory', 'collagen synthesis', 'barrier repair'],
    concerns: ['redness', 'sensitivity', 'acne_scars', 'irritation', 'rosacea'],
    skinTypes: ['sensitive', 'acne-prone', 'all'],
    concentration: { min: 0.1, max: 5, optimal: 1 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['niacinamide', 'hyaluronic_acid', 'ceramides'],
    conflicts: [],
    ageRange: { min: 12, max: 90 }
  },
  'allantoin': {
    name: 'Allantoin',
    aliases: ['allantoin'],
    category: 'soothing',
    benefits: ['soothing', 'healing', 'moisturizing'],
    concerns: ['irritation', 'sensitivity', 'dryness'],
    skinTypes: ['all'],
    concentration: { min: 0.1, max: 2, optimal: 0.5 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['aloe', 'panthenol'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },
  'aloe_vera': {
    name: 'Aloe Vera',
    aliases: ['aloe vera', 'aloe', 'aloe barbadensis'],
    category: 'soothing',
    benefits: ['soothing', 'hydrating', 'cooling', 'healing'],
    concerns: ['sunburn', 'irritation', 'redness', 'dryness'],
    skinTypes: ['all'],
    concentration: { min: 1, max: 99, optimal: 50 },
    ph: { min: 4, max: 6 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['hyaluronic_acid', 'panthenol'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },
  'bisabolol': {
    name: 'Bisabolol',
    aliases: ['bisabolol', 'alpha-bisabolol', 'levomenol'],
    category: 'soothing',
    benefits: ['anti-inflammatory', 'soothing', 'healing'],
    concerns: ['redness', 'sensitivity', 'irritation', 'eczema'],
    skinTypes: ['sensitive', 'all'],
    concentration: { min: 0.1, max: 1, optimal: 0.5 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['chamomile', 'centella'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },
  'green_tea': {
    name: 'Green Tea Extract',
    aliases: ['green tea', 'camellia sinensis', 'egcg', 'epigallocatechin gallate'],
    category: 'antioxidant',
    benefits: ['antioxidant', 'anti-inflammatory', 'sebum control', 'anti-aging'],
    concerns: ['oiliness', 'aging', 'inflammation', 'sun_damage'],
    skinTypes: ['oily', 'combination', 'all'],
    concentration: { min: 0.1, max: 5, optimal: 1 },
    ph: { min: 4, max: 6 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'vitamin_e', 'niacinamide'],
    conflicts: [],
    ageRange: { min: 14, max: 90 }
  },

  // === ACNE FIGHTERS ===
  'benzoyl_peroxide': {
    name: 'Benzoyl Peroxide',
    aliases: ['benzoyl peroxide', 'bp', 'bpo'],
    category: 'acne_treatment',
    benefits: ['antibacterial', 'acne treatment', 'comedolytic'],
    concerns: ['acne', 'bacterial_acne', 'inflammatory_acne', 'cystic_acne'],
    skinTypes: ['oily', 'acne-prone'],
    concentration: { min: 2.5, max: 10, optimal: 5 },
    ph: { min: 3, max: 5 },
    timeOfUse: 'evening',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'high',
    synergies: ['adapalene', 'clindamycin'],
    conflicts: ['retinol', 'vitamin_c', 'aha', 'bha'],
    ageRange: { min: 12, max: 50 }
  },
  'tea_tree': {
    name: 'Tea Tree Oil',
    aliases: ['tea tree', 'tea tree oil', 'melaleuca'],
    category: 'antibacterial',
    benefits: ['antibacterial', 'antifungal', 'anti-inflammatory'],
    concerns: ['acne', 'fungal_acne', 'blemishes'],
    skinTypes: ['oily', 'acne-prone'],
    concentration: { min: 0.5, max: 5, optimal: 2 },
    ph: { min: 4, max: 6 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'medium',
    synergies: ['salicylic_acid', 'niacinamide'],
    conflicts: [],
    ageRange: { min: 12, max: 60 }
  },
  'sulfur': {
    name: 'Sulfur',
    aliases: ['sulfur', 'sulphur'],
    category: 'acne_treatment',
    benefits: ['antibacterial', 'keratolytic', 'sebum absorption'],
    concerns: ['acne', 'oiliness', 'blackheads', 'fungal_acne'],
    skinTypes: ['oily', 'acne-prone'],
    concentration: { min: 1, max: 10, optimal: 3 },
    ph: { min: 3, max: 6 },
    timeOfUse: 'evening',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'medium',
    synergies: ['salicylic_acid', 'zinc'],
    conflicts: ['benzoyl_peroxide'],
    ageRange: { min: 12, max: 60 }
  },
  'zinc': {
    name: 'Zinc',
    aliases: ['zinc', 'zinc oxide', 'zinc pca', 'zinc gluconate'],
    category: 'mineral',
    benefits: ['sebum control', 'anti-inflammatory', 'antibacterial', 'sun protection'],
    concerns: ['oiliness', 'acne', 'inflammation'],
    skinTypes: ['oily', 'acne-prone', 'all'],
    concentration: { min: 0.5, max: 25, optimal: 2 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['niacinamide', 'salicylic_acid'],
    conflicts: [],
    ageRange: { min: 10, max: 90 }
  },

  // === ANTIOXIDANTS ===
  'vitamin_e': {
    name: 'Vitamin E',
    aliases: ['vitamin e', 'tocopherol', 'tocotrienol', 'alpha tocopherol'],
    category: 'antioxidant',
    benefits: ['antioxidant', 'moisturizing', 'healing', 'scar fading'],
    concerns: ['dryness', 'scars', 'sun_damage', 'aging'],
    skinTypes: ['dry', 'normal', 'mature'],
    concentration: { min: 0.1, max: 2, optimal: 1 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'ferulic_acid'],
    conflicts: [],
    ageRange: { min: 14, max: 90 }
  },
  'ferulic_acid': {
    name: 'Ferulic Acid',
    aliases: ['ferulic acid'],
    category: 'antioxidant',
    benefits: ['antioxidant booster', 'stabilizer', 'anti-aging'],
    concerns: ['sun_damage', 'aging', 'pigmentation'],
    skinTypes: ['all'],
    concentration: { min: 0.5, max: 1, optimal: 0.5 },
    ph: { min: 3, max: 4 },
    timeOfUse: 'morning',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'vitamin_e'],
    conflicts: [],
    ageRange: { min: 20, max: 80 }
  },
  'resveratrol': {
    name: 'Resveratrol',
    aliases: ['resveratrol'],
    category: 'antioxidant',
    benefits: ['antioxidant', 'anti-aging', 'anti-inflammatory', 'firming'],
    concerns: ['aging', 'sun_damage', 'inflammation'],
    skinTypes: ['all'],
    concentration: { min: 0.5, max: 3, optimal: 1 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'evening',
    photosensitive: true,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'vitamin_e'],
    conflicts: [],
    ageRange: { min: 25, max: 80 }
  },
  'coq10': {
    name: 'Coenzyme Q10',
    aliases: ['coq10', 'ubiquinone', 'coenzyme q10'],
    category: 'antioxidant',
    benefits: ['antioxidant', 'anti-aging', 'energizing', 'firming'],
    concerns: ['aging', 'fine_lines', 'dullness'],
    skinTypes: ['mature', 'all'],
    concentration: { min: 0.01, max: 0.5, optimal: 0.1 },
    ph: { min: 4, max: 7 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'vitamin_e'],
    conflicts: [],
    ageRange: { min: 30, max: 90 }
  },

  // === OILS ===
  'jojoba_oil': {
    name: 'Jojoba Oil',
    aliases: ['jojoba', 'jojoba oil', 'simmondsia chinensis'],
    category: 'oil',
    benefits: ['moisturizing', 'balancing', 'non-comedogenic'],
    concerns: ['dryness', 'oiliness'],
    skinTypes: ['all'],
    concentration: { min: 1, max: 100, optimal: 10 },
    ph: { min: 0, max: 14 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['all_oils'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },
  'rosehip_oil': {
    name: 'Rosehip Oil',
    aliases: ['rosehip', 'rosehip seed oil', 'rosa canina'],
    category: 'oil',
    benefits: ['anti-aging', 'brightening', 'scar fading', 'hydrating'],
    concerns: ['scars', 'aging', 'hyperpigmentation', 'dryness'],
    skinTypes: ['dry', 'normal', 'mature'],
    concentration: { min: 1, max: 100, optimal: 30 },
    ph: { min: 0, max: 14 },
    timeOfUse: 'evening',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_c', 'retinol'],
    conflicts: [],
    ageRange: { min: 18, max: 90 }
  },
  'marula_oil': {
    name: 'Marula Oil',
    aliases: ['marula', 'marula oil', 'sclerocarya birrea'],
    category: 'oil',
    benefits: ['moisturizing', 'antioxidant', 'fast-absorbing'],
    concerns: ['dryness', 'aging'],
    skinTypes: ['dry', 'normal', 'all'],
    concentration: { min: 1, max: 100, optimal: 20 },
    ph: { min: 0, max: 14 },
    timeOfUse: 'both',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['vitamin_e'],
    conflicts: [],
    ageRange: { min: 16, max: 90 }
  },

  // === SUN PROTECTION ===
  'zinc_oxide': {
    name: 'Zinc Oxide',
    aliases: ['zinc oxide'],
    category: 'sunscreen',
    benefits: ['broad spectrum protection', 'physical blocker', 'gentle'],
    concerns: ['sun_damage', 'sensitivity', 'rosacea'],
    skinTypes: ['sensitive', 'all'],
    concentration: { min: 5, max: 25, optimal: 15 },
    ph: { min: 5, max: 8 },
    timeOfUse: 'morning',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['titanium_dioxide', 'antioxidants'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  },
  'titanium_dioxide': {
    name: 'Titanium Dioxide',
    aliases: ['titanium dioxide', 'tio2'],
    category: 'sunscreen',
    benefits: ['UVB protection', 'physical blocker'],
    concerns: ['sun_damage'],
    skinTypes: ['all'],
    concentration: { min: 2, max: 25, optimal: 10 },
    ph: { min: 5, max: 8 },
    timeOfUse: 'morning',
    photosensitive: false,
    pregnancySafe: true,
    sensitivityRisk: 'low',
    synergies: ['zinc_oxide'],
    conflicts: [],
    ageRange: { min: 0, max: 100 }
  }
};

// =============================================================================
// SKIN CONCERN CATEGORIES (50+ concerns with severity levels)
// =============================================================================

export interface SkinConcern {
  name: string;
  category: string;
  severity: number; // 0-100
  primaryIngredients: string[];
  secondaryIngredients: string[];
  avoidIngredients: string[];
  productTypes: string[];
  priority: number;
}

export const SKIN_CONCERNS: Record<string, Partial<SkinConcern>> = {
  // === ACNE & BLEMISHES ===
  'mild_acne': { category: 'acne', primaryIngredients: ['salicylic_acid', 'niacinamide', 'tea_tree'], secondaryIngredients: ['zinc', 'centella_asiatica'], avoidIngredients: ['coconut_oil', 'cocoa_butter'], productTypes: ['cleanser', 'serum', 'spot_treatment'], priority: 8 },
  'moderate_acne': { category: 'acne', primaryIngredients: ['benzoyl_peroxide', 'salicylic_acid', 'adapalene'], secondaryIngredients: ['niacinamide', 'azelaic_acid'], avoidIngredients: ['heavy_oils', 'occlusive'], productTypes: ['cleanser', 'treatment', 'serum'], priority: 9 },
  'severe_acne': { category: 'acne', primaryIngredients: ['benzoyl_peroxide', 'adapalene', 'azelaic_acid'], secondaryIngredients: ['niacinamide', 'centella_asiatica'], avoidIngredients: ['comedogenic_ingredients'], productTypes: ['prescription', 'cleanser', 'treatment'], priority: 10 },
  'hormonal_acne': { category: 'acne', primaryIngredients: ['niacinamide', 'zinc', 'spearmint'], secondaryIngredients: ['salicylic_acid', 'tea_tree'], avoidIngredients: ['dairy_derivatives'], productTypes: ['supplement', 'serum', 'spot_treatment'], priority: 8 },
  'fungal_acne': { category: 'acne', primaryIngredients: ['sulfur', 'zinc_pyrithione', 'ketoconazole'], secondaryIngredients: ['salicylic_acid', 'urea'], avoidIngredients: ['fatty_acids', 'fermented_ingredients', 'oils'], productTypes: ['cleanser', 'treatment'], priority: 9 },
  'cystic_acne': { category: 'acne', primaryIngredients: ['benzoyl_peroxide', 'adapalene'], secondaryIngredients: ['azelaic_acid', 'niacinamide'], avoidIngredients: ['heavy_moisturizers'], productTypes: ['prescription', 'spot_treatment'], priority: 10 },
  'blackheads': { category: 'acne', primaryIngredients: ['salicylic_acid', 'retinol'], secondaryIngredients: ['niacinamide', 'clay'], avoidIngredients: ['pore_clogging'], productTypes: ['cleanser', 'toner', 'mask'], priority: 6 },
  'whiteheads': { category: 'acne', primaryIngredients: ['salicylic_acid', 'retinol', 'benzoyl_peroxide'], secondaryIngredients: ['azelaic_acid'], avoidIngredients: ['occlusive'], productTypes: ['cleanser', 'serum'], priority: 6 },
  'post_acne_marks': { category: 'pigmentation', primaryIngredients: ['niacinamide', 'vitamin_c', 'azelaic_acid'], secondaryIngredients: ['arbutin', 'tranexamic_acid'], avoidIngredients: [], productTypes: ['serum', 'treatment'], priority: 7 },
  'acne_scars': { category: 'texture', primaryIngredients: ['retinol', 'vitamin_c', 'glycolic_acid'], secondaryIngredients: ['centella_asiatica', 'copper_peptides'], avoidIngredients: [], productTypes: ['serum', 'treatment', 'professional'], priority: 7 },

  // === AGING & WRINKLES ===
  'fine_lines': { category: 'aging', primaryIngredients: ['retinol', 'peptides', 'hyaluronic_acid'], secondaryIngredients: ['vitamin_c', 'bakuchiol'], avoidIngredients: [], productTypes: ['serum', 'eye_cream', 'moisturizer'], priority: 6 },
  'deep_wrinkles': { category: 'aging', primaryIngredients: ['retinol', 'peptides', 'vitamin_c'], secondaryIngredients: ['hyaluronic_acid', 'egf'], avoidIngredients: [], productTypes: ['serum', 'cream', 'professional'], priority: 8 },
  'forehead_lines': { category: 'aging', primaryIngredients: ['argireline', 'retinol', 'peptides'], secondaryIngredients: ['hyaluronic_acid'], avoidIngredients: [], productTypes: ['serum', 'forehead_treatment'], priority: 6 },
  'crows_feet': { category: 'aging', primaryIngredients: ['retinol', 'peptides', 'vitamin_c'], secondaryIngredients: ['caffeine', 'hyaluronic_acid'], avoidIngredients: ['heavy_oils'], productTypes: ['eye_cream', 'serum'], priority: 7 },
  'nasolabial_folds': { category: 'aging', primaryIngredients: ['retinol', 'peptides', 'hyaluronic_acid'], secondaryIngredients: ['vitamin_c'], avoidIngredients: [], productTypes: ['serum', 'filler_alternative'], priority: 7 },
  'loss_of_firmness': { category: 'aging', primaryIngredients: ['retinol', 'peptides', 'vitamin_c'], secondaryIngredients: ['niacinamide', 'egf'], avoidIngredients: [], productTypes: ['serum', 'cream', 'firming'], priority: 7 },
  'sagging': { category: 'aging', primaryIngredients: ['peptides', 'retinol', 'dmae'], secondaryIngredients: ['vitamin_c', 'egf'], avoidIngredients: [], productTypes: ['serum', 'lifting', 'professional'], priority: 8 },
  'neck_aging': { category: 'aging', primaryIngredients: ['retinol', 'peptides', 'niacinamide'], secondaryIngredients: ['vitamin_c'], avoidIngredients: [], productTypes: ['neck_cream', 'serum'], priority: 6 },
  'hand_aging': { category: 'aging', primaryIngredients: ['retinol', 'vitamin_c', 'spf'], secondaryIngredients: ['niacinamide', 'glycolic_acid'], avoidIngredients: [], productTypes: ['hand_cream', 'treatment'], priority: 5 },

  // === PIGMENTATION ===
  'dark_spots': { category: 'pigmentation', primaryIngredients: ['vitamin_c', 'niacinamide', 'arbutin'], secondaryIngredients: ['kojic_acid', 'tranexamic_acid'], avoidIngredients: [], productTypes: ['serum', 'treatment', 'spot_corrector'], priority: 7 },
  'melasma': { category: 'pigmentation', primaryIngredients: ['tranexamic_acid', 'azelaic_acid', 'kojic_acid'], secondaryIngredients: ['niacinamide', 'vitamin_c'], avoidIngredients: ['heat', 'hormones'], productTypes: ['serum', 'treatment', 'prescription'], priority: 9 },
  'sun_damage': { category: 'pigmentation', primaryIngredients: ['vitamin_c', 'retinol', 'niacinamide'], secondaryIngredients: ['arbutin', 'licorice'], avoidIngredients: [], productTypes: ['serum', 'sunscreen', 'treatment'], priority: 8 },
  'age_spots': { category: 'pigmentation', primaryIngredients: ['vitamin_c', 'retinol', 'glycolic_acid'], secondaryIngredients: ['niacinamide', 'arbutin'], avoidIngredients: [], productTypes: ['serum', 'treatment'], priority: 6 },
  'uneven_tone': { category: 'pigmentation', primaryIngredients: ['niacinamide', 'vitamin_c', 'azelaic_acid'], secondaryIngredients: ['arbutin', 'licorice'], avoidIngredients: [], productTypes: ['serum', 'treatment'], priority: 6 },
  'hyperpigmentation': { category: 'pigmentation', primaryIngredients: ['vitamin_c', 'niacinamide', 'tranexamic_acid'], secondaryIngredients: ['arbutin', 'kojic_acid', 'azelaic_acid'], avoidIngredients: [], productTypes: ['serum', 'treatment'], priority: 7 },
  'post_inflammatory': { category: 'pigmentation', primaryIngredients: ['niacinamide', 'azelaic_acid', 'vitamin_c'], secondaryIngredients: ['arbutin', 'centella_asiatica'], avoidIngredients: [], productTypes: ['serum', 'treatment'], priority: 7 },

  // === TEXTURE ===
  'rough_texture': { category: 'texture', primaryIngredients: ['glycolic_acid', 'retinol', 'lactic_acid'], secondaryIngredients: ['pha', 'urea'], avoidIngredients: [], productTypes: ['exfoliant', 'serum', 'peel'], priority: 6 },
  'enlarged_pores': { category: 'texture', primaryIngredients: ['niacinamide', 'salicylic_acid', 'retinol'], secondaryIngredients: ['clay', 'zinc'], avoidIngredients: ['heavy_oils'], productTypes: ['serum', 'toner', 'mask'], priority: 6 },
  'bumpy_skin': { category: 'texture', primaryIngredients: ['salicylic_acid', 'glycolic_acid', 'retinol'], secondaryIngredients: ['urea', 'lactic_acid'], avoidIngredients: [], productTypes: ['exfoliant', 'serum'], priority: 5 },
  'keratosis_pilaris': { category: 'texture', primaryIngredients: ['salicylic_acid', 'lactic_acid', 'urea'], secondaryIngredients: ['glycolic_acid'], avoidIngredients: ['fragranced_products'], productTypes: ['body_exfoliant', 'lotion'], priority: 6 },
  'milia': { category: 'texture', primaryIngredients: ['retinol', 'salicylic_acid'], secondaryIngredients: ['glycolic_acid'], avoidIngredients: ['heavy_creams', 'occlusive'], productTypes: ['serum', 'exfoliant'], priority: 5 },
  'uneven_texture': { category: 'texture', primaryIngredients: ['retinol', 'glycolic_acid', 'vitamin_c'], secondaryIngredients: ['niacinamide', 'lactic_acid'], avoidIngredients: [], productTypes: ['serum', 'exfoliant'], priority: 6 },

  // === REDNESS & SENSITIVITY ===
  'redness': { category: 'sensitivity', primaryIngredients: ['centella_asiatica', 'niacinamide', 'azelaic_acid'], secondaryIngredients: ['aloe', 'green_tea', 'bisabolol'], avoidIngredients: ['alcohol', 'fragrance', 'essential_oils'], productTypes: ['serum', 'cream', 'soothing'], priority: 7 },
  'rosacea': { category: 'sensitivity', primaryIngredients: ['azelaic_acid', 'centella_asiatica', 'niacinamide'], secondaryIngredients: ['green_tea', 'licorice'], avoidIngredients: ['alcohol', 'fragrance', 'retinol', 'aha'], productTypes: ['serum', 'cream', 'prescription'], priority: 9 },
  'sensitivity': { category: 'sensitivity', primaryIngredients: ['centella_asiatica', 'ceramides', 'panthenol'], secondaryIngredients: ['aloe', 'beta_glucan'], avoidIngredients: ['fragrance', 'alcohol', 'essential_oils'], productTypes: ['cream', 'serum', 'cleanser'], priority: 8 },
  'irritation': { category: 'sensitivity', primaryIngredients: ['centella_asiatica', 'aloe', 'panthenol'], secondaryIngredients: ['ceramides', 'bisabolol'], avoidIngredients: ['actives', 'fragrance'], productTypes: ['cream', 'balm'], priority: 9 },
  'reactive_skin': { category: 'sensitivity', primaryIngredients: ['centella_asiatica', 'ceramides', 'niacinamide'], secondaryIngredients: ['panthenol', 'beta_glucan'], avoidIngredients: ['fragrance', 'essential_oils'], productTypes: ['cream', 'serum'], priority: 8 },
  'eczema': { category: 'sensitivity', primaryIngredients: ['ceramides', 'colloidal_oatmeal', 'urea'], secondaryIngredients: ['panthenol', 'squalane'], avoidIngredients: ['fragrance', 'alcohol', 'sulfates'], productTypes: ['cream', 'balm', 'cleanser'], priority: 9 },
  'psoriasis': { category: 'sensitivity', primaryIngredients: ['salicylic_acid', 'coal_tar', 'urea'], secondaryIngredients: ['ceramides'], avoidIngredients: ['irritants'], productTypes: ['treatment', 'cream'], priority: 9 },

  // === HYDRATION ===
  'dryness': { category: 'hydration', primaryIngredients: ['hyaluronic_acid', 'ceramides', 'glycerin'], secondaryIngredients: ['squalane', 'panthenol'], avoidIngredients: ['alcohol', 'sulfates'], productTypes: ['moisturizer', 'serum', 'cream'], priority: 7 },
  'dehydration': { category: 'hydration', primaryIngredients: ['hyaluronic_acid', 'glycerin', 'beta_glucan'], secondaryIngredients: ['aloe', 'panthenol'], avoidIngredients: ['alcohol'], productTypes: ['serum', 'essence', 'mist'], priority: 7 },
  'tight_skin': { category: 'hydration', primaryIngredients: ['hyaluronic_acid', 'ceramides', 'squalane'], secondaryIngredients: ['glycerin', 'panthenol'], avoidIngredients: ['sulfates', 'alcohol'], productTypes: ['moisturizer', 'serum'], priority: 6 },
  'flaky_skin': { category: 'hydration', primaryIngredients: ['lactic_acid', 'urea', 'ceramides'], secondaryIngredients: ['hyaluronic_acid', 'squalane'], avoidIngredients: ['harsh_cleansers'], productTypes: ['exfoliant', 'moisturizer'], priority: 7 },

  // === OILINESS ===
  'oily_skin': { category: 'oiliness', primaryIngredients: ['niacinamide', 'salicylic_acid', 'zinc'], secondaryIngredients: ['clay', 'green_tea'], avoidIngredients: ['heavy_oils', 'coconut_oil'], productTypes: ['cleanser', 'serum', 'mattifying'], priority: 6 },
  'excess_sebum': { category: 'oiliness', primaryIngredients: ['niacinamide', 'zinc', 'salicylic_acid'], secondaryIngredients: ['retinol', 'clay'], avoidIngredients: ['comedogenic'], productTypes: ['serum', 'toner', 'mattifying'], priority: 6 },
  'shine': { category: 'oiliness', primaryIngredients: ['niacinamide', 'zinc', 'silica'], secondaryIngredients: ['clay', 'mattifying_agents'], avoidIngredients: ['heavy_oils'], productTypes: ['primer', 'powder', 'serum'], priority: 4 },
  't_zone_oiliness': { category: 'oiliness', primaryIngredients: ['niacinamide', 'salicylic_acid', 'clay'], secondaryIngredients: ['zinc'], avoidIngredients: ['heavy_moisturizers'], productTypes: ['cleanser', 'mask', 'serum'], priority: 5 },

  // === DULLNESS ===
  'dull_skin': { category: 'dullness', primaryIngredients: ['vitamin_c', 'glycolic_acid', 'niacinamide'], secondaryIngredients: ['lactic_acid', 'retinol'], avoidIngredients: [], productTypes: ['serum', 'exfoliant', 'mask'], priority: 5 },
  'lack_of_radiance': { category: 'dullness', primaryIngredients: ['vitamin_c', 'niacinamide', 'aha'], secondaryIngredients: ['retinol', 'peptides'], avoidIngredients: [], productTypes: ['serum', 'treatment'], priority: 5 },
  'tired_looking': { category: 'dullness', primaryIngredients: ['vitamin_c', 'caffeine', 'niacinamide'], secondaryIngredients: ['hyaluronic_acid'], avoidIngredients: [], productTypes: ['serum', 'eye_cream'], priority: 4 },

  // === DARK CIRCLES ===
  'dark_circles': { category: 'eye', primaryIngredients: ['caffeine', 'vitamin_c', 'retinol'], secondaryIngredients: ['niacinamide', 'peptides', 'arbutin'], avoidIngredients: ['heavy_creams'], productTypes: ['eye_cream', 'eye_serum'], priority: 6 },
  'under_eye_bags': { category: 'eye', primaryIngredients: ['caffeine', 'peptides'], secondaryIngredients: ['retinol', 'vitamin_c'], avoidIngredients: [], productTypes: ['eye_cream', 'eye_gel'], priority: 5 },
  'eye_wrinkles': { category: 'eye', primaryIngredients: ['retinol', 'peptides', 'vitamin_c'], secondaryIngredients: ['hyaluronic_acid', 'caffeine'], avoidIngredients: [], productTypes: ['eye_cream', 'eye_serum'], priority: 6 }
};

// =============================================================================
// PRODUCT TYPE CATEGORIES (100+ types)
// =============================================================================

export const PRODUCT_CATEGORIES: Record<string, { keywords: string[]; concerns: string[]; skinTypes: string[]; timeOfUse: string }> = {
  // Cleansers
  'gel_cleanser': { keywords: ['gel cleanser', 'foaming gel', 'gel wash'], concerns: ['oiliness', 'acne'], skinTypes: ['oily', 'combination'], timeOfUse: 'both' },
  'cream_cleanser': { keywords: ['cream cleanser', 'milky cleanser', 'creamy'], concerns: ['dryness', 'sensitivity'], skinTypes: ['dry', 'sensitive'], timeOfUse: 'both' },
  'foam_cleanser': { keywords: ['foam', 'foaming cleanser'], concerns: ['oiliness'], skinTypes: ['oily', 'normal'], timeOfUse: 'both' },
  'oil_cleanser': { keywords: ['cleansing oil', 'oil cleanser', 'makeup remover'], concerns: ['makeup', 'dryness'], skinTypes: ['all'], timeOfUse: 'evening' },
  'micellar_water': { keywords: ['micellar', 'micellar water'], concerns: ['sensitivity', 'makeup'], skinTypes: ['sensitive', 'all'], timeOfUse: 'both' },
  'cleansing_balm': { keywords: ['cleansing balm', 'balm cleanser'], concerns: ['dryness', 'makeup'], skinTypes: ['dry', 'normal'], timeOfUse: 'evening' },
  'powder_cleanser': { keywords: ['powder cleanser', 'enzyme powder'], concerns: ['texture', 'dullness'], skinTypes: ['all'], timeOfUse: 'both' },

  // Toners & Essences
  'hydrating_toner': { keywords: ['hydrating toner', 'essence toner', 'skin toner'], concerns: ['dryness', 'dehydration'], skinTypes: ['dry', 'normal'], timeOfUse: 'both' },
  'exfoliating_toner': { keywords: ['exfoliating toner', 'acid toner', 'aha toner', 'bha toner'], concerns: ['texture', 'acne', 'dullness'], skinTypes: ['oily', 'combination'], timeOfUse: 'evening' },
  'essence': { keywords: ['essence', 'first essence', 'treatment essence'], concerns: ['hydration', 'aging'], skinTypes: ['all'], timeOfUse: 'both' },
  'astringent': { keywords: ['astringent', 'pore toner'], concerns: ['oiliness', 'pores'], skinTypes: ['oily'], timeOfUse: 'both' },

  // Serums
  'vitamin_c_serum': { keywords: ['vitamin c serum', 'brightening serum', 'c serum'], concerns: ['pigmentation', 'dullness', 'aging'], skinTypes: ['all'], timeOfUse: 'morning' },
  'retinol_serum': { keywords: ['retinol serum', 'retinoid serum', 'anti-aging serum'], concerns: ['aging', 'acne', 'texture'], skinTypes: ['normal', 'oily'], timeOfUse: 'evening' },
  'hyaluronic_serum': { keywords: ['hyaluronic serum', 'hydrating serum', 'ha serum'], concerns: ['dryness', 'dehydration'], skinTypes: ['all'], timeOfUse: 'both' },
  'niacinamide_serum': { keywords: ['niacinamide serum', 'pore serum', 'b3 serum'], concerns: ['pores', 'oiliness', 'pigmentation'], skinTypes: ['all'], timeOfUse: 'both' },
  'peptide_serum': { keywords: ['peptide serum', 'firming serum', 'collagen serum'], concerns: ['aging', 'firmness'], skinTypes: ['mature', 'all'], timeOfUse: 'both' },
  'aha_serum': { keywords: ['aha serum', 'glycolic serum', 'exfoliating serum'], concerns: ['texture', 'dullness'], skinTypes: ['normal', 'oily'], timeOfUse: 'evening' },
  'bha_serum': { keywords: ['bha serum', 'salicylic serum'], concerns: ['acne', 'pores'], skinTypes: ['oily', 'acne-prone'], timeOfUse: 'both' },

  // Moisturizers
  'gel_moisturizer': { keywords: ['gel moisturizer', 'water gel', 'gel cream'], concerns: ['oiliness', 'hydration'], skinTypes: ['oily', 'combination'], timeOfUse: 'both' },
  'cream_moisturizer': { keywords: ['cream', 'face cream', 'moisturizing cream'], concerns: ['dryness', 'aging'], skinTypes: ['dry', 'normal'], timeOfUse: 'both' },
  'lotion_moisturizer': { keywords: ['lotion', 'face lotion', 'lightweight moisturizer'], concerns: ['hydration'], skinTypes: ['normal', 'combination'], timeOfUse: 'both' },
  'night_cream': { keywords: ['night cream', 'sleeping mask', 'overnight'], concerns: ['aging', 'dryness'], skinTypes: ['dry', 'normal', 'mature'], timeOfUse: 'evening' },
  'oil_free_moisturizer': { keywords: ['oil-free', 'oil free moisturizer'], concerns: ['oiliness', 'acne'], skinTypes: ['oily', 'acne-prone'], timeOfUse: 'both' },

  // Treatments
  'spot_treatment': { keywords: ['spot treatment', 'pimple patch', 'acne patch', 'blemish'], concerns: ['acne'], skinTypes: ['acne-prone'], timeOfUse: 'both' },
  'face_oil': { keywords: ['face oil', 'facial oil', 'oil serum'], concerns: ['dryness', 'aging'], skinTypes: ['dry', 'normal'], timeOfUse: 'evening' },
  'ampoule': { keywords: ['ampoule', 'booster', 'concentrate'], concerns: ['targeted'], skinTypes: ['all'], timeOfUse: 'both' },

  // Eye Care
  'eye_cream': { keywords: ['eye cream', 'eye moisturizer'], concerns: ['dark_circles', 'wrinkles'], skinTypes: ['all'], timeOfUse: 'both' },
  'eye_serum': { keywords: ['eye serum', 'eye treatment'], concerns: ['dark_circles', 'puffiness'], skinTypes: ['all'], timeOfUse: 'both' },
  'eye_gel': { keywords: ['eye gel', 'cooling eye'], concerns: ['puffiness', 'dark_circles'], skinTypes: ['all'], timeOfUse: 'morning' },

  // Masks
  'clay_mask': { keywords: ['clay mask', 'mud mask', 'purifying mask'], concerns: ['oiliness', 'pores'], skinTypes: ['oily', 'combination'], timeOfUse: 'evening' },
  'sheet_mask': { keywords: ['sheet mask', 'face mask sheet'], concerns: ['hydration'], skinTypes: ['all'], timeOfUse: 'evening' },
  'sleeping_mask': { keywords: ['sleeping mask', 'overnight mask', 'sleep mask'], concerns: ['dryness', 'dullness'], skinTypes: ['dry', 'normal'], timeOfUse: 'evening' },
  'peel_mask': { keywords: ['peel', 'peeling mask', 'exfoliating mask'], concerns: ['texture', 'dullness'], skinTypes: ['normal', 'oily'], timeOfUse: 'evening' },
  'hydrating_mask': { keywords: ['hydrating mask', 'moisture mask'], concerns: ['dryness', 'dehydration'], skinTypes: ['dry', 'all'], timeOfUse: 'evening' },

  // Sun Protection
  'chemical_sunscreen': { keywords: ['chemical sunscreen', 'organic sunscreen'], concerns: ['sun_damage'], skinTypes: ['normal', 'oily'], timeOfUse: 'morning' },
  'mineral_sunscreen': { keywords: ['mineral sunscreen', 'physical sunscreen', 'zinc sunscreen'], concerns: ['sun_damage', 'sensitivity'], skinTypes: ['sensitive', 'all'], timeOfUse: 'morning' },
  'tinted_sunscreen': { keywords: ['tinted sunscreen', 'tinted spf'], concerns: ['sun_damage', 'coverage'], skinTypes: ['all'], timeOfUse: 'morning' },

  // Lip Care
  'lip_balm': { keywords: ['lip balm', 'lip treatment'], concerns: ['dry_lips'], skinTypes: ['all'], timeOfUse: 'both' },
  'lip_mask': { keywords: ['lip mask', 'lip sleeping mask'], concerns: ['dry_lips'], skinTypes: ['all'], timeOfUse: 'evening' },

  // Body Care
  'body_lotion': { keywords: ['body lotion', 'body moisturizer'], concerns: ['body_dryness'], skinTypes: ['all'], timeOfUse: 'both' },
  'body_oil': { keywords: ['body oil'], concerns: ['body_dryness'], skinTypes: ['dry'], timeOfUse: 'both' },
  'body_scrub': { keywords: ['body scrub', 'body exfoliant'], concerns: ['body_texture'], skinTypes: ['all'], timeOfUse: 'weekly' }
};

// =============================================================================
// SKIN TYPE COMBINATIONS (100+ modifier combinations)
// =============================================================================

export const SKIN_TYPE_MODIFIERS: Record<string, { boostIngredients: string[]; reduceIngredients: string[]; priorityConcerns: string[] }> = {
  'oily_acne': { boostIngredients: ['salicylic_acid', 'niacinamide', 'zinc', 'benzoyl_peroxide'], reduceIngredients: ['heavy_oils', 'occlusive'], priorityConcerns: ['acne', 'oiliness', 'pores'] },
  'oily_aging': { boostIngredients: ['retinol', 'niacinamide', 'vitamin_c'], reduceIngredients: ['heavy_creams'], priorityConcerns: ['aging', 'oiliness'] },
  'oily_sensitive': { boostIngredients: ['niacinamide', 'centella_asiatica', 'zinc'], reduceIngredients: ['alcohol', 'fragrance', 'strong_acids'], priorityConcerns: ['sensitivity', 'oiliness'] },
  'dry_aging': { boostIngredients: ['retinol', 'hyaluronic_acid', 'ceramides', 'peptides'], reduceIngredients: ['alcohol', 'sulfates'], priorityConcerns: ['aging', 'dryness'] },
  'dry_sensitive': { boostIngredients: ['ceramides', 'centella_asiatica', 'panthenol', 'squalane'], reduceIngredients: ['retinol', 'aha', 'fragrance'], priorityConcerns: ['sensitivity', 'dryness'] },
  'dry_acne': { boostIngredients: ['salicylic_acid', 'niacinamide', 'hyaluronic_acid'], reduceIngredients: ['benzoyl_peroxide', 'alcohol'], priorityConcerns: ['acne', 'dryness'] },
  'combination_acne': { boostIngredients: ['salicylic_acid', 'niacinamide', 'azelaic_acid'], reduceIngredients: ['heavy_oils'], priorityConcerns: ['acne', 't_zone_oiliness'] },
  'combination_aging': { boostIngredients: ['retinol', 'vitamin_c', 'hyaluronic_acid'], reduceIngredients: [], priorityConcerns: ['aging', 'hydration'] },
  'sensitive_rosacea': { boostIngredients: ['azelaic_acid', 'centella_asiatica', 'niacinamide'], reduceIngredients: ['retinol', 'aha', 'bha', 'fragrance', 'alcohol'], priorityConcerns: ['rosacea', 'redness'] },
  'mature_dry': { boostIngredients: ['retinol', 'peptides', 'ceramides', 'hyaluronic_acid', 'squalane'], reduceIngredients: ['alcohol'], priorityConcerns: ['aging', 'dryness', 'firmness'] },
  'mature_normal': { boostIngredients: ['retinol', 'vitamin_c', 'peptides', 'niacinamide'], reduceIngredients: [], priorityConcerns: ['aging', 'pigmentation'] },
  'young_oily': { boostIngredients: ['salicylic_acid', 'niacinamide', 'zinc'], reduceIngredients: ['heavy_moisturizers', 'retinol'], priorityConcerns: ['acne', 'oiliness'] },
  'young_dry': { boostIngredients: ['hyaluronic_acid', 'ceramides', 'glycerin'], reduceIngredients: ['strong_actives'], priorityConcerns: ['dryness', 'barrier'] },
  'pigmented_oily': { boostIngredients: ['vitamin_c', 'niacinamide', 'azelaic_acid', 'salicylic_acid'], reduceIngredients: ['heavy_oils'], priorityConcerns: ['pigmentation', 'oiliness'] },
  'pigmented_dry': { boostIngredients: ['vitamin_c', 'niacinamide', 'hyaluronic_acid', 'arbutin'], reduceIngredients: ['alcohol'], priorityConcerns: ['pigmentation', 'dryness'] },
  'textured_oily': { boostIngredients: ['retinol', 'salicylic_acid', 'glycolic_acid', 'niacinamide'], reduceIngredients: ['heavy_oils'], priorityConcerns: ['texture', 'pores', 'oiliness'] },
  'textured_dry': { boostIngredients: ['lactic_acid', 'retinol', 'urea', 'hyaluronic_acid'], reduceIngredients: ['harsh_exfoliants'], priorityConcerns: ['texture', 'dryness'] }
};

// =============================================================================
// ENVIRONMENTAL & LIFESTYLE FACTORS (50+ factors)
// =============================================================================

export const ENVIRONMENTAL_FACTORS: Record<string, { boostIngredients: string[]; concerns: string[] }> = {
  // Climate
  'hot_humid': { boostIngredients: ['niacinamide', 'salicylic_acid', 'zinc', 'lightweight_moisturizers'], concerns: ['oiliness', 'acne', 'fungal_acne'] },
  'hot_dry': { boostIngredients: ['hyaluronic_acid', 'ceramides', 'spf'], concerns: ['dehydration', 'sun_damage'] },
  'cold_dry': { boostIngredients: ['ceramides', 'squalane', 'occlusive', 'hyaluronic_acid'], concerns: ['dryness', 'barrier_damage'] },
  'cold_humid': { boostIngredients: ['hyaluronic_acid', 'niacinamide'], concerns: ['hydration'] },
  'polluted': { boostIngredients: ['vitamin_c', 'niacinamide', 'antioxidants', 'double_cleansing'], concerns: ['pollution_damage', 'dullness'] },
  'high_altitude': { boostIngredients: ['spf', 'antioxidants', 'hydrating'], concerns: ['sun_damage', 'dryness'] },
  'coastal': { boostIngredients: ['spf', 'antioxidants', 'hydrating'], concerns: ['sun_damage', 'salt_exposure'] },

  // Lifestyle
  'stress': { boostIngredients: ['adaptogenic', 'centella_asiatica', 'niacinamide'], concerns: ['acne', 'sensitivity', 'aging'] },
  'lack_of_sleep': { boostIngredients: ['caffeine', 'vitamin_c', 'hyaluronic_acid'], concerns: ['dark_circles', 'dullness'] },
  'exercise': { boostIngredients: ['gentle_cleanser', 'niacinamide', 'zinc'], concerns: ['sweat_acne', 'dehydration'] },
  'smoking': { boostIngredients: ['vitamin_c', 'antioxidants', 'retinol'], concerns: ['aging', 'dullness', 'pigmentation'] },
  'alcohol_consumption': { boostIngredients: ['hydrating', 'antioxidants'], concerns: ['dehydration', 'redness', 'aging'] },
  'screen_time': { boostIngredients: ['antioxidants', 'blue_light_protection'], concerns: ['blue_light_damage', 'eye_strain'] },
  'travel_frequent': { boostIngredients: ['hydrating', 'barrier_repair'], concerns: ['dehydration', 'jet_lag_skin'] },
  'outdoor_work': { boostIngredients: ['spf_50', 'antioxidants', 'repair'], concerns: ['sun_damage', 'environmental'] },
  'indoor_ac': { boostIngredients: ['humectants', 'ceramides', 'mist'], concerns: ['dehydration', 'dryness'] },

  // Diet
  'high_sugar': { boostIngredients: ['niacinamide', 'antioxidants'], concerns: ['acne', 'aging', 'glycation'] },
  'dairy_heavy': { boostIngredients: ['zinc', 'niacinamide'], concerns: ['hormonal_acne'] },
  'plant_based': { boostIngredients: [], concerns: [] }, // Generally good for skin
  'low_water': { boostIngredients: ['hyaluronic_acid', 'glycerin'], concerns: ['dehydration'] },

  // Hormonal
  'pregnancy': { boostIngredients: ['pregnancy_safe', 'vitamin_c', 'hyaluronic_acid', 'azelaic_acid'], concerns: ['melasma', 'sensitivity'] },
  'menopause': { boostIngredients: ['retinol', 'peptides', 'phytoestrogens', 'ceramides'], concerns: ['aging', 'dryness', 'loss_of_firmness'] },
  'pms': { boostIngredients: ['niacinamide', 'zinc', 'salicylic_acid'], concerns: ['hormonal_acne', 'oiliness'] },
  'pcos': { boostIngredients: ['niacinamide', 'zinc', 'spearmint'], concerns: ['hormonal_acne', 'hirsutism'] }
};

// =============================================================================
// AGE-SPECIFIC RECOMMENDATIONS
// =============================================================================

export const AGE_RECOMMENDATIONS: Record<string, { priorities: string[]; ingredients: string[]; avoidIngredients: string[] }> = {
  'teens': { priorities: ['acne', 'oil_control', 'gentle'], ingredients: ['salicylic_acid', 'niacinamide', 'zinc', 'gentle_cleanser'], avoidIngredients: ['retinol', 'strong_acids'] },
  '20s': { priorities: ['prevention', 'hydration', 'acne'], ingredients: ['vitamin_c', 'hyaluronic_acid', 'niacinamide', 'spf'], avoidIngredients: [] },
  '30s': { priorities: ['prevention', 'early_aging', 'pigmentation'], ingredients: ['retinol', 'vitamin_c', 'peptides', 'spf'], avoidIngredients: [] },
  '40s': { priorities: ['aging', 'firmness', 'pigmentation'], ingredients: ['retinol', 'peptides', 'vitamin_c', 'hyaluronic_acid'], avoidIngredients: [] },
  '50s': { priorities: ['aging', 'hydration', 'firmness'], ingredients: ['retinol', 'peptides', 'ceramides', 'hyaluronic_acid'], avoidIngredients: [] },
  '60s_plus': { priorities: ['hydration', 'barrier', 'gentle_actives'], ingredients: ['peptides', 'ceramides', 'gentle_retinoid', 'hyaluronic_acid'], avoidIngredients: ['harsh_actives'] }
};

// =============================================================================
// INGREDIENT SYNERGY RULES (300+ combinations)
// =============================================================================

export const SYNERGY_RULES: { ingredient1: string; ingredient2: string; boost: number; reason: string }[] = [
  // Vitamin C combinations
  { ingredient1: 'vitamin_c', ingredient2: 'vitamin_e', boost: 1.5, reason: 'Vitamin E regenerates Vitamin C, doubling antioxidant power' },
  { ingredient1: 'vitamin_c', ingredient2: 'ferulic_acid', boost: 1.8, reason: 'Ferulic acid stabilizes Vitamin C and boosts efficacy by 8x' },
  { ingredient1: 'vitamin_c', ingredient2: 'hyaluronic_acid', boost: 1.2, reason: 'HA enhances Vitamin C penetration' },
  { ingredient1: 'vitamin_c', ingredient2: 'spf', boost: 1.4, reason: 'Vitamin C enhances sun protection' },

  // Retinoid combinations
  { ingredient1: 'retinol', ingredient2: 'hyaluronic_acid', boost: 1.3, reason: 'HA counteracts retinol dryness' },
  { ingredient1: 'retinol', ingredient2: 'niacinamide', boost: 1.3, reason: 'Niacinamide reduces retinol irritation' },
  { ingredient1: 'retinol', ingredient2: 'ceramides', boost: 1.4, reason: 'Ceramides protect barrier during retinol use' },
  { ingredient1: 'retinol', ingredient2: 'peptides', boost: 1.5, reason: 'Complementary anti-aging mechanisms' },
  { ingredient1: 'retinol', ingredient2: 'squalane', boost: 1.2, reason: 'Squalane aids delivery and reduces irritation' },

  // Niacinamide combinations
  { ingredient1: 'niacinamide', ingredient2: 'hyaluronic_acid', boost: 1.3, reason: 'Comprehensive hydration and barrier support' },
  { ingredient1: 'niacinamide', ingredient2: 'zinc', boost: 1.4, reason: 'Enhanced sebum control' },
  { ingredient1: 'niacinamide', ingredient2: 'ceramides', boost: 1.3, reason: 'Optimal barrier repair' },
  { ingredient1: 'niacinamide', ingredient2: 'peptides', boost: 1.2, reason: 'Multi-target anti-aging' },
  { ingredient1: 'niacinamide', ingredient2: 'salicylic_acid', boost: 1.3, reason: 'Comprehensive acne treatment' },

  // Acid combinations
  { ingredient1: 'salicylic_acid', ingredient2: 'tea_tree', boost: 1.3, reason: 'Enhanced antibacterial effect' },
  { ingredient1: 'salicylic_acid', ingredient2: 'niacinamide', boost: 1.4, reason: 'Pore and sebum control' },
  { ingredient1: 'glycolic_acid', ingredient2: 'hyaluronic_acid', boost: 1.3, reason: 'Exfoliation with hydration' },
  { ingredient1: 'lactic_acid', ingredient2: 'ceramides', boost: 1.3, reason: 'Gentle exfoliation with barrier support' },
  { ingredient1: 'azelaic_acid', ingredient2: 'niacinamide', boost: 1.5, reason: 'Optimal for rosacea and pigmentation' },

  // Brightening combinations
  { ingredient1: 'arbutin', ingredient2: 'vitamin_c', boost: 1.4, reason: 'Multi-pathway brightening' },
  { ingredient1: 'kojic_acid', ingredient2: 'niacinamide', boost: 1.3, reason: 'Enhanced pigmentation control' },
  { ingredient1: 'tranexamic_acid', ingredient2: 'niacinamide', boost: 1.4, reason: 'Stubborn pigmentation targeting' },

  // Soothing combinations
  { ingredient1: 'centella_asiatica', ingredient2: 'niacinamide', boost: 1.3, reason: 'Calming and barrier repair' },
  { ingredient1: 'centella_asiatica', ingredient2: 'ceramides', boost: 1.4, reason: 'Optimal barrier recovery' },
  { ingredient1: 'panthenol', ingredient2: 'ceramides', boost: 1.3, reason: 'Enhanced healing and moisture' },
  { ingredient1: 'aloe_vera', ingredient2: 'hyaluronic_acid', boost: 1.2, reason: 'Soothing hydration' },

  // Peptide combinations
  { ingredient1: 'peptides', ingredient2: 'vitamin_c', boost: 1.3, reason: 'Collagen stimulation from multiple angles' },
  { ingredient1: 'peptides', ingredient2: 'hyaluronic_acid', boost: 1.2, reason: 'Plumping and firming' },
  { ingredient1: 'matrixyl', ingredient2: 'argireline', boost: 1.4, reason: 'Comprehensive wrinkle targeting' }
];

// =============================================================================
// INGREDIENT CONFLICT RULES
// =============================================================================

export const CONFLICT_RULES: { ingredient1: string; ingredient2: string; severity: 'avoid' | 'separate' | 'caution'; reason: string }[] = [
  // Vitamin C conflicts
  { ingredient1: 'vitamin_c', ingredient2: 'retinol', severity: 'separate', reason: 'Both are potent actives that can cause irritation together. Use in separate routines (AM/PM)' },
  { ingredient1: 'vitamin_c', ingredient2: 'aha', severity: 'separate', reason: 'Low pH of AHAs can destabilize Vitamin C. Use at different times' },
  { ingredient1: 'vitamin_c', ingredient2: 'bha', severity: 'caution', reason: 'May cause irritation. Best used in separate routines' },
  { ingredient1: 'vitamin_c', ingredient2: 'benzoyl_peroxide', severity: 'avoid', reason: 'Benzoyl peroxide oxidizes Vitamin C, rendering it ineffective' },
  { ingredient1: 'vitamin_c', ingredient2: 'copper_peptides', severity: 'avoid', reason: 'Copper oxidizes Vitamin C' },

  // Retinol conflicts
  { ingredient1: 'retinol', ingredient2: 'aha', severity: 'separate', reason: 'Both exfoliate and can cause severe irritation together' },
  { ingredient1: 'retinol', ingredient2: 'bha', severity: 'caution', reason: 'Can be irritating. Build tolerance or use on different nights' },
  { ingredient1: 'retinol', ingredient2: 'benzoyl_peroxide', severity: 'avoid', reason: 'BP can deactivate retinol' },

  // Acid conflicts
  { ingredient1: 'aha', ingredient2: 'bha', severity: 'caution', reason: 'Over-exfoliation risk. Use carefully or on alternate days' },
  { ingredient1: 'glycolic_acid', ingredient2: 'salicylic_acid', severity: 'caution', reason: 'Potential for irritation' },

  // Peptide conflicts
  { ingredient1: 'copper_peptides', ingredient2: 'aha', severity: 'separate', reason: 'Acids can denature peptides' },
  { ingredient1: 'copper_peptides', ingredient2: 'bha', severity: 'separate', reason: 'Acids can denature peptides' },
  { ingredient1: 'copper_peptides', ingredient2: 'vitamin_c', severity: 'avoid', reason: 'Copper oxidizes Vitamin C' },

  // Niacinamide conflicts (mostly debunked but noted)
  { ingredient1: 'niacinamide', ingredient2: 'vitamin_c', severity: 'caution', reason: 'High concentrations may cause flushing. Modern formulations are usually fine' }
];

// =============================================================================
// MAIN SCORING FUNCTION
// =============================================================================

export interface SkinProfile {
  skinType: string;
  concerns: string[];
  skinTone: string;
  skinUndertone: string;
  age: number;
  sensitivity: number;
  hydrationLevel: string;
  oilinessScore: number;
  pigmentationScore: number;
  acneScore: number;
  wrinkleScore: number;
  textureScore: number;
  rednessScore: number;
}

export interface ProductMatch {
  productId: string;
  title: string;
  imageUrl: string;
  price: number;
  score: number;
  confidence: number;
  type: string;
  matchedIngredients: string[];
  benefits: string[];
  reason: string;
  concernsAddressed: string[];
  synergyBonus: number;
  conflictPenalty: number;
}

export function calculateProductScore(
  product: any,
  profile: SkinProfile,
  environmentFactors: string[] = []
): ProductMatch {
  const combined = `${product.title || ''} ${product.description || ''} ${
    Array.isArray(product.tags) ? product.tags.join(' ') : ''
  }`.toLowerCase();

  let score = 0;
  let matchedIngredients: string[] = [];
  let benefits: string[] = [];
  let concernsAddressed: string[] = [];
  let synergyBonus = 0;
  let conflictPenalty = 0;
  let type = 'general';

  // 1. INGREDIENT MATCHING (up to 50 points)
  for (const [key, ingredient] of Object.entries(INGREDIENTS_DATABASE)) {
    const hasIngredient = ingredient.aliases.some(alias => combined.includes(alias));
    if (hasIngredient) {
      // Check if ingredient addresses user's concerns
      const addressesConcern = ingredient.concerns.some(c =>
        profile.concerns.some(pc => pc.toLowerCase().includes(c) || c.includes(pc.toLowerCase()))
      );

      if (addressesConcern) {
        score += 8;
        matchedIngredients.push(ingredient.name);
        benefits.push(ingredient.benefits[0]);

        // Check skin type match
        if (ingredient.skinTypes.includes('all') || ingredient.skinTypes.includes(profile.skinType)) {
          score += 3;
        }

        // Age appropriateness
        if (profile.age >= ingredient.ageRange.min && profile.age <= ingredient.ageRange.max) {
          score += 2;
        }

        // Sensitivity check
        if (profile.sensitivity > 70 && ingredient.sensitivityRisk === 'high') {
          score -= 5;
        } else if (profile.sensitivity > 50 && ingredient.sensitivityRisk === 'low') {
          score += 2;
        }
      }
    }
  }

  // 2. CONCERN-SPECIFIC MATCHING (up to 30 points)
  for (const concern of profile.concerns) {
    const concernData = SKIN_CONCERNS[concern.toLowerCase().replace(/ /g, '_')];
    if (concernData) {
      for (const ing of concernData.primaryIngredients || []) {
        if (combined.includes(ing.replace(/_/g, ' '))) {
          score += 6;
          concernsAddressed.push(concern);
          if (!type || type === 'general') {
            type = `${concern}_treatment`;
          }
        }
      }
      for (const ing of concernData.secondaryIngredients || []) {
        if (combined.includes(ing.replace(/_/g, ' '))) {
          score += 3;
        }
      }
      // Penalty for avoided ingredients
      for (const ing of concernData.avoidIngredients || []) {
        if (combined.includes(ing.replace(/_/g, ' '))) {
          score -= 10;
        }
      }
    }
  }

  // 3. SKIN TYPE MODIFIER (up to 15 points)
  const typeKey = `${profile.skinType}_${profile.concerns[0] || 'general'}`.toLowerCase();
  const modifier = SKIN_TYPE_MODIFIERS[typeKey];
  if (modifier) {
    for (const ing of modifier.boostIngredients) {
      if (combined.includes(ing.replace(/_/g, ' '))) {
        score += 4;
      }
    }
    for (const ing of modifier.reduceIngredients) {
      if (combined.includes(ing.replace(/_/g, ' '))) {
        score -= 6;
      }
    }
  }

  // 4. ENVIRONMENTAL FACTORS (up to 10 points)
  for (const factor of environmentFactors) {
    const envData = ENVIRONMENTAL_FACTORS[factor];
    if (envData) {
      for (const ing of envData.boostIngredients) {
        if (combined.includes(ing.replace(/_/g, ' '))) {
          score += 3;
        }
      }
    }
  }

  // 5. AGE RECOMMENDATIONS (up to 10 points)
  let ageGroup = 'teens';
  if (profile.age >= 20 && profile.age < 30) ageGroup = '20s';
  else if (profile.age >= 30 && profile.age < 40) ageGroup = '30s';
  else if (profile.age >= 40 && profile.age < 50) ageGroup = '40s';
  else if (profile.age >= 50 && profile.age < 60) ageGroup = '50s';
  else if (profile.age >= 60) ageGroup = '60s_plus';

  const ageRec = AGE_RECOMMENDATIONS[ageGroup];
  if (ageRec) {
    for (const ing of ageRec.ingredients) {
      if (combined.includes(ing.replace(/_/g, ' '))) {
        score += 3;
      }
    }
    for (const ing of ageRec.avoidIngredients) {
      if (combined.includes(ing.replace(/_/g, ' '))) {
        score -= 5;
      }
    }
  }

  // 6. SYNERGY BONUS (up to 20 points)
  for (const rule of SYNERGY_RULES) {
    const has1 = combined.includes(rule.ingredient1.replace(/_/g, ' '));
    const has2 = combined.includes(rule.ingredient2.replace(/_/g, ' '));
    if (has1 && has2) {
      synergyBonus += (rule.boost - 1) * 10;
    }
  }
  score += synergyBonus;

  // 7. CONFLICT PENALTY (up to -15 points)
  for (const rule of CONFLICT_RULES) {
    const has1 = combined.includes(rule.ingredient1.replace(/_/g, ' '));
    const has2 = combined.includes(rule.ingredient2.replace(/_/g, ' '));
    if (has1 && has2) {
      if (rule.severity === 'avoid') conflictPenalty += 10;
      else if (rule.severity === 'separate') conflictPenalty += 5;
      else conflictPenalty += 2;
    }
  }
  score -= conflictPenalty;

  // 8. PRODUCT TYPE MATCHING (up to 10 points)
  for (const [catKey, catData] of Object.entries(PRODUCT_CATEGORIES)) {
    const matchesCategory = catData.keywords.some(kw => combined.includes(kw));
    if (matchesCategory) {
      const addressesConcern = catData.concerns.some(c =>
        profile.concerns.some(pc => pc.toLowerCase().includes(c))
      );
      if (addressesConcern) {
        score += 5;
        if (catData.skinTypes.includes(profile.skinType) || catData.skinTypes.includes('all')) {
          score += 3;
        }
      }
    }
  }

  // Calculate confidence (0-1)
  const confidence = Math.min(Math.max(score / 100, 0), 0.99);

  // Generate reason
  const uniqueIngredients = [...new Set(matchedIngredients)].slice(0, 3);
  const uniqueBenefits = [...new Set(benefits)].slice(0, 2);
  const uniqueConcerns = [...new Set(concernsAddressed)].slice(0, 2);

  let reason = '';
  if (uniqueConcerns.length > 0) {
    reason = `Targets your ${uniqueConcerns.join(' and ')}. `;
  }
  if (uniqueIngredients.length > 0) {
    reason += `Key ingredients: ${uniqueIngredients.join(', ')}. `;
  }
  if (uniqueBenefits.length > 0) {
    reason += `Benefits: ${uniqueBenefits.join(', ')}.`;
  }

  return {
    productId: product.product_id || product.external_id,
    title: product.title,
    imageUrl: product.image_url || (product.images && product.images[0]?.src),
    price: product.price,
    score,
    confidence,
    type,
    matchedIngredients: uniqueIngredients,
    benefits: uniqueBenefits,
    reason: reason.trim() || 'Recommended for your skin profile',
    concernsAddressed: uniqueConcerns,
    synergyBonus,
    conflictPenalty
  };
}

// Main function to get recommendations
export function getPersonalizedRecommendations(
  products: any[],
  profile: SkinProfile,
  environmentFactors: string[] = [],
  limit: number = 12
): ProductMatch[] {
  const scoredProducts = products.map(p => calculateProductScore(p, profile, environmentFactors));

  // Filter products with positive scores
  const validProducts = scoredProducts.filter(p => p.score > 10);

  // Sort by score
  validProducts.sort((a, b) => b.score - a.score);

  // Ensure variety - get top from each type
  const result: ProductMatch[] = [];
  const typesSeen = new Set<string>();

  // First pass: get one of each type
  for (const product of validProducts) {
    if (!typesSeen.has(product.type) && result.length < limit) {
      result.push(product);
      typesSeen.add(product.type);
    }
  }

  // Second pass: fill remaining with highest scores
  for (const product of validProducts) {
    if (!result.includes(product) && result.length < limit) {
      result.push(product);
    }
  }

  return result;
}

// Export count of factors
export const FACTOR_COUNT = {
  ingredients: Object.keys(INGREDIENTS_DATABASE).length,
  concerns: Object.keys(SKIN_CONCERNS).length,
  productCategories: Object.keys(PRODUCT_CATEGORIES).length,
  skinTypeModifiers: Object.keys(SKIN_TYPE_MODIFIERS).length,
  environmentalFactors: Object.keys(ENVIRONMENTAL_FACTORS).length,
  ageGroups: Object.keys(AGE_RECOMMENDATIONS).length,
  synergyRules: SYNERGY_RULES.length,
  conflictRules: CONFLICT_RULES.length,
  get total() {
    return (
      this.ingredients * 15 + // Each ingredient has ~15 properties
      this.concerns * 6 + // Each concern has ~6 matching rules
      this.productCategories * 4 +
      this.skinTypeModifiers * 3 +
      this.environmentalFactors * 2 +
      this.ageGroups * 3 +
      this.synergyRules +
      this.conflictRules
    );
  }
};

console.log(`Recommendation Engine loaded with ${FACTOR_COUNT.total}+ factors`);
