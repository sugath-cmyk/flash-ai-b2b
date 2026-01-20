import { pool } from '../config/database';

// Types
interface KnowledgeArticle {
  id: string;
  category: string;
  topic: string;
  question: string;
  answer: string;
  shortAnswer: string | null;
  sources: string[];
  keywords: string[];
  relatedConcerns: string[];
  relatedIngredients: string[];
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  viewCount: number;
  helpfulCount: number;
}

interface SearchResult {
  article: KnowledgeArticle;
  relevanceScore: number;
  matchedKeywords: string[];
}

// Common skincare questions for seeding the knowledge base
const SKINCARE_KNOWLEDGE_SEED = [
  {
    category: 'ingredients',
    topic: 'Retinol Basics',
    question: 'What is retinol and how does it work?',
    answer: 'Retinol is a form of vitamin A that promotes cell turnover and collagen production. It works by binding to retinoid receptors in skin cells, speeding up skin renewal. This helps reduce fine lines, wrinkles, and uneven skin tone. Start with a low concentration (0.25-0.5%) 2-3 times per week, then gradually increase. Always use sunscreen during the day as retinol increases sun sensitivity.',
    shortAnswer: 'Vitamin A derivative that boosts cell turnover and collagen production.',
    sources: ['Journal of Investigative Dermatology', 'AAD Guidelines'],
    keywords: ['retinol', 'vitamin a', 'anti-aging', 'wrinkles', 'cell turnover'],
    relatedConcerns: ['wrinkles', 'aging', 'fine_lines', 'uneven_tone'],
    relatedIngredients: ['retinaldehyde', 'tretinoin', 'adapalene'],
    difficultyLevel: 'beginner',
  },
  {
    category: 'ingredients',
    topic: 'Niacinamide Benefits',
    question: 'What does niacinamide do for skin?',
    answer: 'Niacinamide (Vitamin B3) is a versatile ingredient that strengthens the skin barrier, reduces pore appearance, controls oil production, and fades dark spots. It also has anti-inflammatory properties, making it suitable for acne-prone and sensitive skin. Unlike many actives, niacinamide is well-tolerated and can be used with most other ingredients. Effective concentrations range from 2-10%.',
    shortAnswer: 'Versatile vitamin B3 that balances oil, minimizes pores, and fades spots.',
    sources: ['British Journal of Dermatology', 'Clinical Studies'],
    keywords: ['niacinamide', 'vitamin b3', 'pores', 'oil control', 'dark spots'],
    relatedConcerns: ['oily_skin', 'large_pores', 'hyperpigmentation', 'acne'],
    relatedIngredients: ['zinc', 'hyaluronic_acid'],
    difficultyLevel: 'beginner',
  },
  {
    category: 'ingredients',
    topic: 'Vitamin C Types',
    question: 'What\'s the difference between vitamin C forms?',
    answer: 'L-Ascorbic Acid is the most potent but least stable form. It requires low pH (under 3.5) and dark packaging. Sodium Ascorbyl Phosphate is gentler and more stable, good for sensitive skin. Ascorbyl Glucoside is stable and converts to vitamin C in skin. Tetrahexyldecyl Ascorbate is oil-soluble and penetrates better. For beginners, start with a stable derivative like SAP at 10-15%.',
    shortAnswer: 'L-AA is most potent; derivatives like SAP and AG are more stable.',
    sources: ['Dermatologic Surgery Journal', 'Cosmetic Chemist Research'],
    keywords: ['vitamin c', 'ascorbic acid', 'brightening', 'antioxidant', 'sap'],
    relatedConcerns: ['dullness', 'dark_spots', 'sun_damage', 'aging'],
    relatedIngredients: ['ferulic_acid', 'vitamin_e', 'niacinamide'],
    difficultyLevel: 'intermediate',
  },
  {
    category: 'routines',
    topic: 'Active Layering',
    question: 'Can I use retinol and vitamin C together?',
    answer: 'While they can be used together, it\'s often better to separate them. Vitamin C works best at low pH (morning), while retinol is most effective at neutral pH (night). Using both at night can increase irritation risk. Recommended approach: Vitamin C in AM (with sunscreen), Retinol in PM. If using together, apply vitamin C first, wait 30 minutes, then apply retinol.',
    shortAnswer: 'Best to separate: Vitamin C in morning, Retinol at night.',
    sources: ['Dermatology Research and Practice', 'Expert Consensus'],
    keywords: ['layering', 'retinol', 'vitamin c', 'routine order', 'actives'],
    relatedConcerns: ['aging', 'brightening', 'anti-aging'],
    relatedIngredients: ['retinol', 'ascorbic_acid', 'niacinamide'],
    difficultyLevel: 'intermediate',
  },
  {
    category: 'routines',
    topic: 'Basic Routine Order',
    question: 'What order should I apply my skincare products?',
    answer: 'The general rule is thinnest to thickest consistency. Morning: Cleanser → Toner (optional) → Essence → Serum → Eye cream → Moisturizer → Sunscreen. Evening: Cleanser (double cleanse if wearing makeup) → Toner → Essence → Treatment/Serum → Eye cream → Moisturizer/Night cream → Face oil (optional). Wait 1-2 minutes between active products.',
    shortAnswer: 'Thin to thick: cleanser, toner, serum, moisturizer, sunscreen (AM).',
    sources: ['AAD Skincare Guidelines', 'Dermatologist Recommendations'],
    keywords: ['routine', 'order', 'layering', 'skincare steps', 'application'],
    relatedConcerns: ['all'],
    relatedIngredients: [],
    difficultyLevel: 'beginner',
  },
  {
    category: 'concerns',
    topic: 'Acne Treatment',
    question: 'What ingredients are best for acne?',
    answer: 'Key acne-fighting ingredients include: Salicylic Acid (BHA) - unclogs pores, 0.5-2%. Benzoyl Peroxide - kills bacteria, 2.5-5%. Niacinamide - reduces inflammation, 2-5%. Retinoids - prevent clogged pores. Tea Tree Oil - natural antimicrobial. Azelaic Acid - antibacterial and brightening. Start with one active, use consistently for 6-8 weeks before adding another.',
    shortAnswer: 'BHA, benzoyl peroxide, niacinamide, retinoids work best for acne.',
    sources: ['Journal of the American Academy of Dermatology', 'Clinical Trials'],
    keywords: ['acne', 'pimples', 'breakouts', 'bha', 'salicylic acid', 'benzoyl peroxide'],
    relatedConcerns: ['acne', 'oily_skin', 'clogged_pores'],
    relatedIngredients: ['salicylic_acid', 'benzoyl_peroxide', 'niacinamide', 'retinol'],
    difficultyLevel: 'beginner',
  },
  {
    category: 'concerns',
    topic: 'Hyperpigmentation',
    question: 'How do I fade dark spots and hyperpigmentation?',
    answer: 'Effective brightening ingredients: Vitamin C - inhibits melanin production. Alpha Arbutin - gentle melanin inhibitor. Tranexamic Acid - prevents pigment transfer. Kojic Acid - natural brightener. Azelaic Acid - evens tone. Niacinamide - prevents new spots. Retinoids - speed cell turnover. Always use SPF 30+ as sun exposure worsens pigmentation. Results take 8-12 weeks of consistent use.',
    shortAnswer: 'Vitamin C, arbutin, tranexamic acid + daily SPF 30+ for best results.',
    sources: ['Pigment Cell & Melanoma Research', 'Dermatology Studies'],
    keywords: ['dark spots', 'hyperpigmentation', 'melasma', 'brightening', 'uneven tone'],
    relatedConcerns: ['hyperpigmentation', 'dark_spots', 'melasma', 'sun_damage'],
    relatedIngredients: ['vitamin_c', 'arbutin', 'tranexamic_acid', 'niacinamide'],
    difficultyLevel: 'intermediate',
  },
  {
    category: 'myths',
    topic: 'Natural vs Synthetic',
    question: 'Are natural ingredients better than synthetic ones?',
    answer: 'Not necessarily. "Natural" doesn\'t mean safer or more effective. Many synthetic ingredients are identical to natural ones but more stable and pure. For example, synthetic vitamin C can be more effective than plant extracts. Some natural ingredients like essential oils can cause irritation. What matters is the ingredient\'s proven efficacy and your skin\'s tolerance, not its origin.',
    shortAnswer: 'No - efficacy and safety matter more than natural vs synthetic origin.',
    sources: ['Cosmetic Ingredient Review', 'Dermatology Research'],
    keywords: ['natural', 'synthetic', 'organic', 'clean beauty', 'myths'],
    relatedConcerns: [],
    relatedIngredients: [],
    difficultyLevel: 'beginner',
  },
  {
    category: 'concerns',
    topic: 'Dehydrated Skin',
    question: 'What\'s the difference between dry and dehydrated skin?',
    answer: 'Dry skin is a skin TYPE lacking oil (sebum). Dehydrated skin is a CONDITION lacking water, affecting any skin type. Signs of dehydration: tightness, dullness, fine lines appearing worse, oily yet flaky skin. Dry skin needs oils and occlusives. Dehydrated skin needs humectants (hyaluronic acid, glycerin) and proper hydration. You can have oily dehydrated skin - it overproduces oil to compensate for water loss.',
    shortAnswer: 'Dry = lacks oil (type). Dehydrated = lacks water (condition, any type).',
    sources: ['International Journal of Cosmetic Science'],
    keywords: ['dry skin', 'dehydrated', 'hydration', 'moisture', 'skin types'],
    relatedConcerns: ['dryness', 'dehydration', 'flaky_skin'],
    relatedIngredients: ['hyaluronic_acid', 'glycerin', 'ceramides', 'squalane'],
    difficultyLevel: 'beginner',
  },
  {
    category: 'concerns',
    topic: 'Sensitive Skin Care',
    question: 'What ingredients should sensitive skin avoid?',
    answer: 'Common irritants for sensitive skin: Fragrance (parfum) - #1 sensitizer. Essential oils - can cause reactions. Alcohol denat - drying and irritating. Harsh sulfates - strip skin barrier. High-concentration acids - start low. Physical exfoliants - too abrasive. Look for: fragrance-free, minimal ingredients, soothing ingredients like centella, aloe, oat. Always patch test new products for 24-48 hours.',
    shortAnswer: 'Avoid fragrance, essential oils, harsh alcohols, and high-strength acids.',
    sources: ['Contact Dermatitis Journal', 'Allergy Research'],
    keywords: ['sensitive skin', 'irritation', 'fragrance free', 'gentle', 'soothing'],
    relatedConcerns: ['sensitivity', 'redness', 'irritation', 'rosacea'],
    relatedIngredients: ['centella', 'aloe', 'oat', 'allantoin'],
    difficultyLevel: 'beginner',
  },
  {
    category: 'tips',
    topic: 'Sunscreen Basics',
    question: 'How much sunscreen should I apply?',
    answer: 'Apply 1/4 teaspoon (about 2 finger lengths) for face alone. Most people apply only 25-50% of the needed amount. Reapply every 2 hours when outdoors, or immediately after swimming/sweating. SPF 30 blocks 97% of UVB; SPF 50 blocks 98%. Choose broad-spectrum (UVA+UVB). Chemical sunscreens need 15-20 minutes to activate; mineral sunscreens work immediately.',
    shortAnswer: 'Apply 1/4 tsp (2 finger lengths) to face, reapply every 2 hours outdoors.',
    sources: ['Skin Cancer Foundation', 'AAD Guidelines'],
    keywords: ['sunscreen', 'spf', 'sun protection', 'uva', 'uvb', 'reapply'],
    relatedConcerns: ['sun_damage', 'aging', 'hyperpigmentation'],
    relatedIngredients: ['zinc_oxide', 'titanium_dioxide', 'avobenzone'],
    difficultyLevel: 'beginner',
  },
  {
    category: 'ingredients',
    topic: 'AHA vs BHA',
    question: 'What\'s the difference between AHA and BHA?',
    answer: 'AHAs (glycolic, lactic acid) are water-soluble, work on skin surface, best for dry/sun-damaged skin, and help with texture/fine lines. BHAs (salicylic acid) are oil-soluble, penetrate pores, best for oily/acne-prone skin, and help with blackheads/breakouts. Start with low concentrations (5-10% AHA or 0.5-2% BHA) 2-3x weekly. Don\'t combine high-strength AHA+BHA initially.',
    shortAnswer: 'AHA: surface exfoliation, dry skin. BHA: pore-penetrating, oily/acne skin.',
    sources: ['Journal of Clinical and Aesthetic Dermatology'],
    keywords: ['aha', 'bha', 'exfoliation', 'glycolic', 'salicylic', 'acids'],
    relatedConcerns: ['texture', 'acne', 'dullness', 'clogged_pores'],
    relatedIngredients: ['glycolic_acid', 'lactic_acid', 'salicylic_acid', 'mandelic_acid'],
    difficultyLevel: 'intermediate',
  },
];

class SkincareKnowledgeService {
  /**
   * Initialize knowledge base with seed data
   */
  async seedKnowledgeBase(): Promise<number> {
    let insertedCount = 0;

    for (const article of SKINCARE_KNOWLEDGE_SEED) {
      try {
        await pool.query(
          `INSERT INTO skincare_knowledge
            (category, topic, question, answer, short_answer, sources, keywords, related_concerns, related_ingredients, difficulty_level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT DO NOTHING`,
          [
            article.category,
            article.topic,
            article.question,
            article.answer,
            article.shortAnswer,
            article.sources,
            article.keywords,
            article.relatedConcerns,
            article.relatedIngredients,
            article.difficultyLevel,
          ]
        );
        insertedCount++;
      } catch (error) {
        console.warn(`Failed to insert knowledge article: ${article.topic}`, error);
      }
    }

    return insertedCount;
  }

  /**
   * Search knowledge base for relevant articles
   */
  async searchKnowledge(query: string, limit: number = 5): Promise<SearchResult[]> {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Search by keywords and content
    const result = await pool.query(
      `SELECT *,
        (
          CASE WHEN LOWER(question) LIKE $1 THEN 10 ELSE 0 END +
          CASE WHEN LOWER(topic) LIKE $1 THEN 8 ELSE 0 END +
          CASE WHEN LOWER(answer) LIKE $1 THEN 5 ELSE 0 END +
          CASE WHEN $2 && keywords THEN 15 ELSE 0 END +
          CASE WHEN $2 && related_concerns THEN 12 ELSE 0 END +
          CASE WHEN $2 && related_ingredients THEN 10 ELSE 0 END
        ) as relevance_score
       FROM skincare_knowledge
       WHERE is_active = true
         AND (
           LOWER(question) LIKE $1
           OR LOWER(topic) LIKE $1
           OR LOWER(answer) LIKE $1
           OR LOWER(category) LIKE $1
           OR $2 && keywords
           OR $2 && related_concerns
           OR $2 && related_ingredients
         )
       ORDER BY relevance_score DESC, helpful_count DESC
       LIMIT $3`,
      [`%${queryLower}%`, queryWords, limit]
    );

    return result.rows.map((row: any) => ({
      article: this.mapRowToArticle(row),
      relevanceScore: row.relevance_score,
      matchedKeywords: queryWords.filter(w =>
        row.keywords?.includes(w) ||
        row.related_concerns?.includes(w) ||
        row.related_ingredients?.includes(w)
      ),
    }));
  }

  /**
   * Get articles by category
   */
  async getByCategory(category: string, limit: number = 20): Promise<KnowledgeArticle[]> {
    const result = await pool.query(
      `SELECT * FROM skincare_knowledge
       WHERE category = $1 AND is_active = true
       ORDER BY view_count DESC, helpful_count DESC
       LIMIT $2`,
      [category, limit]
    );

    return result.rows.map((row: any) => this.mapRowToArticle(row));
  }

  /**
   * Get articles related to specific concerns
   */
  async getByConcern(concern: string, limit: number = 10): Promise<KnowledgeArticle[]> {
    const result = await pool.query(
      `SELECT * FROM skincare_knowledge
       WHERE $1 = ANY(related_concerns) AND is_active = true
       ORDER BY helpful_count DESC
       LIMIT $2`,
      [concern.toLowerCase(), limit]
    );

    return result.rows.map((row: any) => this.mapRowToArticle(row));
  }

  /**
   * Get articles related to specific ingredient
   */
  async getByIngredient(ingredient: string, limit: number = 10): Promise<KnowledgeArticle[]> {
    const result = await pool.query(
      `SELECT * FROM skincare_knowledge
       WHERE $1 = ANY(related_ingredients) AND is_active = true
       ORDER BY helpful_count DESC
       LIMIT $2`,
      [ingredient.toLowerCase(), limit]
    );

    return result.rows.map((row: any) => this.mapRowToArticle(row));
  }

  /**
   * Get article by ID
   */
  async getById(id: string): Promise<KnowledgeArticle | null> {
    const result = await pool.query(
      `SELECT * FROM skincare_knowledge WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Increment view count
    await pool.query(
      `UPDATE skincare_knowledge SET view_count = view_count + 1 WHERE id = $1`,
      [id]
    );

    return this.mapRowToArticle(result.rows[0]);
  }

  /**
   * Mark article as helpful
   */
  async markHelpful(id: string): Promise<void> {
    await pool.query(
      `UPDATE skincare_knowledge SET helpful_count = helpful_count + 1 WHERE id = $1`,
      [id]
    );
  }

  /**
   * Get all categories with counts
   */
  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    const result = await pool.query(
      `SELECT category, COUNT(*) as count
       FROM skincare_knowledge
       WHERE is_active = true
       GROUP BY category
       ORDER BY count DESC`
    );

    return result.rows.map((row: { category: string; count: string }) => ({
      category: row.category,
      count: parseInt(row.count),
    }));
  }

  /**
   * Get popular/trending articles
   */
  async getPopular(limit: number = 10): Promise<KnowledgeArticle[]> {
    const result = await pool.query(
      `SELECT * FROM skincare_knowledge
       WHERE is_active = true
       ORDER BY (view_count + helpful_count * 2) DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => this.mapRowToArticle(row));
  }

  /**
   * Build context string for AI chat from relevant knowledge
   */
  async buildKnowledgeContext(userQuery: string, concerns: string[] = []): Promise<string> {
    let context = '';

    // Search for directly relevant articles
    const searchResults = await this.searchKnowledge(userQuery, 3);

    if (searchResults.length > 0) {
      context += '\n\nRELEVANT SKINCARE KNOWLEDGE:\n';
      for (const result of searchResults) {
        context += `\nQ: ${result.article.question}\n`;
        context += `A: ${result.article.shortAnswer || result.article.answer.substring(0, 200)}\n`;
      }
    }

    // Add concern-specific knowledge
    for (const concern of concerns.slice(0, 2)) {
      const concernArticles = await this.getByConcern(concern, 2);
      if (concernArticles.length > 0 && !searchResults.some(r => concernArticles.some(a => a.id === r.article.id))) {
        for (const article of concernArticles) {
          context += `\nFor ${concern}: ${article.shortAnswer || article.answer.substring(0, 150)}\n`;
        }
      }
    }

    return context;
  }

  /**
   * Add new knowledge article
   */
  async addArticle(article: Omit<KnowledgeArticle, 'id' | 'viewCount' | 'helpfulCount'>): Promise<string> {
    const result = await pool.query(
      `INSERT INTO skincare_knowledge
        (category, topic, question, answer, short_answer, sources, keywords, related_concerns, related_ingredients, difficulty_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        article.category,
        article.topic,
        article.question,
        article.answer,
        article.shortAnswer,
        article.sources,
        article.keywords,
        article.relatedConcerns,
        article.relatedIngredients,
        article.difficultyLevel,
      ]
    );

    return result.rows[0].id;
  }

  private mapRowToArticle(row: any): KnowledgeArticle {
    return {
      id: row.id,
      category: row.category,
      topic: row.topic,
      question: row.question,
      answer: row.answer,
      shortAnswer: row.short_answer,
      sources: row.sources || [],
      keywords: row.keywords || [],
      relatedConcerns: row.related_concerns || [],
      relatedIngredients: row.related_ingredients || [],
      difficultyLevel: row.difficulty_level,
      viewCount: row.view_count || 0,
      helpfulCount: row.helpful_count || 0,
    };
  }
}

export default new SkincareKnowledgeService();
