/**
 * Query Categorization Service
 * Automatically categorizes user queries using keyword pattern matching
 */

interface CategoryPattern {
  category: string;
  keywords: string[];
  weight: number; // Higher weight = higher priority
}

interface QueryAnalysis {
  category: string;
  topics: string[];
  intent: string;
  confidence: number;
}

export class QueryCategorizationService {
  // Category patterns with keywords and weights
  private readonly categoryPatterns: CategoryPattern[] = [
    {
      category: 'ingredients',
      keywords: [
        'ingredient', 'ingredients', 'contain', 'contains', 'formula', 'composition',
        'niacinamide', 'retinol', 'vitamin', 'acid', 'serum', 'extract',
        'what\'s in', 'whats in', 'made of', 'component', 'active', 'actives'
      ],
      weight: 10
    },
    {
      category: 'product_inquiry',
      keywords: [
        'what is', 'tell me about', 'explain', 'describe', 'information',
        'does it', 'can it', 'will it', 'help', 'work', 'effective',
        'recommend', 'recommendation', 'suggest', 'best for', 'good for',
        'which product', 'product for', 'suitable', 'right for'
      ],
      weight: 8
    },
    {
      category: 'usage_instructions',
      keywords: [
        'how to use', 'how do i', 'how should', 'apply', 'application',
        'routine', 'regimen', 'when to use', 'how often', 'frequency',
        'steps', 'instruction', 'morning', 'evening', 'night', 'day',
        'before', 'after', 'layer', 'layering', 'order', 'sequence'
      ],
      weight: 9
    },
    {
      category: 'shipping',
      keywords: [
        'ship', 'shipping', 'deliver', 'delivery', 'courier', 'dispatch',
        'how long', 'when will', 'arrival', 'arrive', 'track', 'tracking',
        'express', 'standard', 'international', 'domestic', 'location'
      ],
      weight: 10
    },
    {
      category: 'returns',
      keywords: [
        'return', 'returns', 'refund', 'exchange', 'money back',
        'cancel', 'cancellation', 'change order', 'wrong product',
        'damaged', 'defective', 'replace', 'replacement'
      ],
      weight: 10
    },
    {
      category: 'pricing',
      keywords: [
        'price', 'cost', 'how much', 'expensive', 'cheap', 'cheaper',
        'discount', 'offer', 'sale', 'coupon', 'code', 'deal',
        'payment', 'pay', 'affordable', 'budget', 'value'
      ],
      weight: 9
    },
    {
      category: 'safety',
      keywords: [
        'safe', 'safety', 'pregnant', 'pregnancy', 'breastfeeding',
        'allergy', 'allergic', 'sensitive', 'sensitivity', 'reaction',
        'side effect', 'irritation', 'burn', 'sting', 'redness',
        'doctor', 'dermatologist', 'medical'
      ],
      weight: 10
    },
    {
      category: 'comparison',
      keywords: [
        'difference', 'different', 'compare', 'comparison', 'versus', 'vs',
        'better', 'best', 'which one', 'or', 'alternative', 'similar'
      ],
      weight: 7
    }
  ];

  // Common stop words to remove when extracting topics
  private readonly stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'can', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
    'this', 'that', 'these', 'those', 'of', 'in', 'on', 'at', 'to', 'for',
    'with', 'from', 'by', 'about', 'as', 'and', 'or', 'but', 'if', 'what',
    'how', 'when', 'where', 'why', 'who', 'which'
  ]);

  /**
   * Categorize a query into one of the predefined categories
   */
  categorizeQuery(query: string): string {
    const normalizedQuery = query.toLowerCase();
    const scores: { [key: string]: number } = {};

    // Score each category based on keyword matches
    for (const pattern of this.categoryPatterns) {
      let score = 0;
      for (const keyword of pattern.keywords) {
        if (normalizedQuery.includes(keyword)) {
          score += pattern.weight;
        }
      }
      if (score > 0) {
        scores[pattern.category] = score;
      }
    }

    // Return category with highest score, or 'general' if no matches
    if (Object.keys(scores).length === 0) {
      return 'general';
    }

    const bestCategory = Object.entries(scores).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0];

    return bestCategory;
  }

  /**
   * Extract relevant topics/keywords from query
   */
  extractTopics(query: string): string[] {
    const words = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word =>
        word.length > 2 && // Minimum 3 characters
        !this.stopWords.has(word) && // Not a stop word
        !/^\d+$/.test(word) // Not just numbers
      );

    // Remove duplicates and take top 5 most relevant
    const uniqueWords = Array.from(new Set(words));

    // Prioritize skincare/beauty-related terms
    const priorityTerms = uniqueWords.filter(word =>
      this.isSkincareTerm(word)
    );

    const regularTerms = uniqueWords.filter(word =>
      !this.isSkincareTerm(word)
    );

    return [...priorityTerms, ...regularTerms].slice(0, 5);
  }

  /**
   * Detect user intent from query
   */
  detectIntent(query: string): string {
    const normalizedQuery = query.toLowerCase();

    // Question patterns
    if (this.isQuestion(normalizedQuery)) {
      if (normalizedQuery.includes('how')) return 'seeking_guidance';
      if (normalizedQuery.includes('what') || normalizedQuery.includes('which')) return 'seeking_information';
      if (normalizedQuery.includes('when')) return 'seeking_timing';
      if (normalizedQuery.includes('where')) return 'seeking_location';
      if (normalizedQuery.includes('why')) return 'seeking_explanation';
      if (normalizedQuery.includes('can') || normalizedQuery.includes('should')) return 'seeking_validation';
      return 'asking_question';
    }

    // Action patterns
    if (normalizedQuery.includes('want') || normalizedQuery.includes('need')) {
      return 'expressing_need';
    }

    if (normalizedQuery.includes('recommend') || normalizedQuery.includes('suggest')) {
      return 'seeking_recommendation';
    }

    if (normalizedQuery.includes('problem') || normalizedQuery.includes('issue') || normalizedQuery.includes('concern')) {
      return 'reporting_problem';
    }

    if (normalizedQuery.includes('buy') || normalizedQuery.includes('purchase') || normalizedQuery.includes('order')) {
      return 'purchase_intent';
    }

    return 'general_inquiry';
  }

  /**
   * Perform comprehensive query analysis
   */
  analyzeQuery(query: string): QueryAnalysis {
    const category = this.categorizeQuery(query);
    const topics = this.extractTopics(query);
    const intent = this.detectIntent(query);

    // Calculate confidence based on how many keywords matched
    const confidence = this.calculateConfidence(query, category);

    return {
      category,
      topics,
      intent,
      confidence
    };
  }

  /**
   * Check if word is a skincare/beauty related term
   */
  private isSkincareTerm(word: string): boolean {
    const skincareTerms = new Set([
      'skin', 'face', 'serum', 'cream', 'lotion', 'cleanser', 'toner',
      'moisturizer', 'sunscreen', 'spf', 'mask', 'exfoliant', 'peel',
      'acne', 'wrinkle', 'aging', 'dark', 'spot', 'hyperpigmentation',
      'hydration', 'dry', 'oily', 'sensitive', 'combination',
      'niacinamide', 'retinol', 'vitamin', 'acid', 'hyaluronic',
      'salicylic', 'glycolic', 'lactic', 'peptide', 'ceramide',
      'antioxidant', 'collagen', 'elastin', 'brightening', 'firming',
      'soothing', 'calming', 'nourishing', 'redness', 'inflammation',
      'texture', 'pore', 'pores', 'blackhead', 'whitehead', 'blemish'
    ]);

    return skincareTerms.has(word);
  }

  /**
   * Check if query is a question
   */
  private isQuestion(query: string): boolean {
    return (
      query.includes('?') ||
      /^(what|how|when|where|why|who|which|can|should|is|are|do|does|will|would)/i.test(query)
    );
  }

  /**
   * Calculate confidence score based on keyword matches
   */
  private calculateConfidence(query: string, category: string): number {
    if (category === 'general') {
      return 0.5; // Low confidence for general category
    }

    const pattern = this.categoryPatterns.find(p => p.category === category);
    if (!pattern) {
      return 0.5;
    }

    const normalizedQuery = query.toLowerCase();
    let matches = 0;

    for (const keyword of pattern.keywords) {
      if (normalizedQuery.includes(keyword)) {
        matches++;
      }
    }

    // Confidence based on number of keyword matches
    const confidence = Math.min(0.6 + (matches * 0.1), 1.0);
    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }
}

export default new QueryCategorizationService();
