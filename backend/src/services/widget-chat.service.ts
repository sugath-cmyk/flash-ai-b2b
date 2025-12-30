import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import Anthropic from '@anthropic-ai/sdk';
import queryCategorizationService from './query-categorization.service';
import queryCacheService from './query-cache.service';

interface WidgetChatRequest {
  storeId: string;
  sessionId: string;
  visitorId?: string;
  message: string;
  conversationId?: string;
  productContext?: {
    productId?: string;
    productTitle?: string;
    productDescription?: string;
    price?: string;
    vendor?: string;
  };
}

export class WidgetChatService {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  async chat(request: WidgetChatRequest): Promise<{ conversationId: string; message: string; }> {
    const { storeId, sessionId, visitorId, message, conversationId, productContext } = request;

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = await this.createConversation(storeId, sessionId, visitorId);
    }

    // Step 1: Analyze and categorize the query
    const queryAnalysis = queryCategorizationService.analyzeQuery(message);
    console.log(`📊 Query categorized as: ${queryAnalysis.category} (confidence: ${queryAnalysis.confidence})`);

    // Step 2: Check cache for similar queries (BEFORE calling AI)
    const cachedResponse = await queryCacheService.findCachedResponse(storeId, message);

    if (cachedResponse) {
      console.log(`⚡ Cache HIT! Using cached response (similarity: ${cachedResponse.similarity})`);

      // Save user message with categorization
      await this.saveMessage(convId, storeId, 'user', message, null, queryAnalysis);

      // Save cached assistant response
      await this.saveMessage(
        convId,
        storeId,
        'assistant',
        cachedResponse.responseContent,
        0, // No tokens used for cached response
        {
          cached_from: cachedResponse.id,
          cache_key: cachedResponse.cacheKey
        }
      );

      // Record cache hit
      await queryCacheService.recordCacheHit(cachedResponse.id);

      return {
        conversationId: convId,
        message: cachedResponse.responseContent,
      };
    }

    console.log(`💭 Cache MISS. Calling AI...`);

    // Save user message with categorization
    await this.saveMessage(convId, storeId, 'user', message, null, queryAnalysis);

    // Get store info for branding
    const storeResult = await pool.query(
      'SELECT store_name, domain FROM stores WHERE id = $1',
      [storeId]
    );
    const storeName = storeResult.rows[0]?.store_name || storeResult.rows[0]?.domain || 'this store';

    // Get store context (products, info, etc.)
    const storeContext = await this.getStoreContext(storeId, productContext);

    // Get conversation history
    const history = await this.getConversationHistory(convId);

    // Step 3: Generate AI response with store context
    const aiResponse = await this.generateResponse(storeName, storeContext, history, message);

    // Step 4: Save AI response
    const cacheKey = queryCacheService.generateCacheKey(queryCacheService.normalizeQuery(message));
    await this.saveMessage(
      convId,
      storeId,
      'assistant',
      aiResponse.content,
      aiResponse.tokens,
      {
        cache_key: cacheKey,
        query_category: queryAnalysis.category
      }
    );

    // Step 5: Cache the response for future reuse (7 days expiry)
    await queryCacheService.cacheResponse(storeId, message, aiResponse.content, {
      category: queryAnalysis.category,
      topics: queryAnalysis.topics,
      intent: queryAnalysis.intent,
      expiresIn: 7 * 24 * 60 * 60 // 7 days
    });

    return {
      conversationId: convId,
      message: aiResponse.content,
    };
  }

  private async createConversation(storeId: string, sessionId: string, visitorId?: string): Promise<string> {
    const result = await pool.query(
      `INSERT INTO widget_conversations (store_id, session_id, visitor_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [storeId, sessionId, visitorId || null, 'active']
    );

    return result.rows[0].id;
  }

  private async getConversationHistory(conversationId: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT role, content
       FROM widget_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 30`,
      [conversationId]
    );

    return result.rows;
  }

  private async saveMessage(
    conversationId: string,
    storeId: string,
    role: 'user' | 'assistant',
    content: string,
    tokens?: number | null,
    metadata?: any
  ): Promise<void> {
    // For user messages, include categorization metadata
    if (role === 'user' && metadata) {
      await pool.query(
        `INSERT INTO widget_messages
         (conversation_id, store_id, role, content, model, tokens, query_category, query_intent, query_topics, query_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          conversationId,
          storeId,
          role,
          content,
          null,
          tokens || null,
          metadata.category || null,
          metadata.intent || null,
          metadata.topics || [],
          JSON.stringify({ confidence: metadata.confidence || 0 })
        ]
      );
    }
    // For assistant messages, include cache metadata
    else if (role === 'assistant' && metadata) {
      await pool.query(
        `INSERT INTO widget_messages
         (conversation_id, store_id, role, content, model, tokens, cached_from, cache_key, query_category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          conversationId,
          storeId,
          role,
          content,
          'claude-sonnet-4-5-20250929',
          tokens || null,
          metadata.cached_from || null,
          metadata.cache_key || null,
          metadata.query_category || null
        ]
      );
    }
    // Default behavior for simple messages
    else {
      await pool.query(
        `INSERT INTO widget_messages (conversation_id, store_id, role, content, model, tokens)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [conversationId, storeId, role, content, role === 'assistant' ? 'claude-sonnet-4-5-20250929' : null, tokens || null]
      );
    }
  }

  private async getStoreContext(storeId: string, productContext?: any): Promise<string> {
    // Get store info
    const storeResult = await pool.query(
      'SELECT store_name, domain, metadata FROM stores WHERE id = $1',
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return '';
    }

    const store = storeResult.rows[0];

    // Build context string
    let context = `Store: ${store.store_name || store.domain}\n\n`;

    // If viewing a specific product, prioritize that product's context
    if (productContext && productContext.productTitle) {
      context += `CURRENT PRODUCT BEING VIEWED:\n`;
      context += `Title: ${productContext.productTitle}\n`;
      if (productContext.vendor) {
        context += `Brand: ${productContext.vendor}\n`;
      }
      if (productContext.price) {
        context += `Price: $${productContext.price}\n`;
      }
      if (productContext.productDescription) {
        context += `Description: ${productContext.productDescription}\n`;
      }
      context += `\n`;
    }

    // Get products - try enhanced query first, fallback to basic if Phase 2 not deployed
    let productsResult;
    try {
      productsResult = await pool.query(
        `SELECT
           title, description, short_description, price, product_type, vendor,
           ingredients, key_benefits, skin_types, concerns,
           usage_instructions, usage_frequency, usage_time, results_timeline,
           texture, product_category, product_subcategory,
           is_vegan, is_cruelty_free, is_pregnancy_safe, is_fragrance_free,
           allergens
         FROM extracted_products
         WHERE store_id = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 20`,
        [storeId]
      );
    } catch (error: any) {
      // Fallback to basic query if Phase 2 columns don't exist yet
      console.log('Using basic product query (Phase 2 columns not available)');
      productsResult = await pool.query(
        `SELECT title, description, short_description, price, product_type, vendor
         FROM extracted_products
         WHERE store_id = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 20`,
        [storeId]
      );
    }

    // Get collections
    const collectionsResult = await pool.query(
      `SELECT title, description
       FROM extracted_collections
       WHERE store_id = $1
       LIMIT 10`,
      [storeId]
    );

    // Get store pages for policies, about, etc.
    const pagesResult = await pool.query(
      `SELECT page_type, title, content
       FROM extracted_pages
       WHERE store_id = $1
       LIMIT 10`,
      [storeId]
    );

    if (productsResult.rows.length > 0) {
      context += `Other Available Products:\n`;
      productsResult.rows.forEach((product, idx) => {
        context += `${idx + 1}. ${product.title} - ₹${product.price}`;

        // Add short description or benefits (Phase 2 enhanced data)
        if (product.short_description) {
          context += ` - ${product.short_description}`;
        } else if (product.key_benefits && product.key_benefits.length > 0) {
          context += ` - Benefits: ${product.key_benefits.slice(0, 3).join(', ')}`;
        }

        // Add category and skin types (Phase 2)
        if (product.product_category) {
          context += `\n   Category: ${product.product_category}`;
          if (product.skin_types && product.skin_types.length > 0) {
            context += ` | For: ${product.skin_types.join(', ')} skin`;
          }
        }

        // Add key concerns addressed (Phase 2)
        if (product.concerns && product.concerns.length > 0) {
          context += `\n   Targets: ${product.concerns.slice(0, 3).join(', ')}`;
        }

        // Add key ingredients (Phase 2)
        if (product.ingredients && product.ingredients.length > 0) {
          context += `\n   Key ingredients: ${product.ingredients.slice(0, 3).join(', ')}`;
        }

        // Add important flags (Phase 2)
        if (product.is_vegan || product.is_cruelty_free || product.is_pregnancy_safe !== undefined || product.is_fragrance_free) {
          const flags = [];
          if (product.is_vegan) flags.push('Vegan');
          if (product.is_cruelty_free) flags.push('Cruelty-free');
          if (product.is_pregnancy_safe === true) flags.push('Pregnancy-safe');
          if (product.is_pregnancy_safe === false) flags.push('⚠️ NOT pregnancy-safe');
          if (product.is_fragrance_free) flags.push('Fragrance-free');
          if (flags.length > 0) {
            context += `\n   ${flags.join(' • ')}`;
          }
        }

        context += `\n`;
      });
      context += `\n`;
    }

    if (collectionsResult.rows.length > 0) {
      context += `Product Categories:\n`;
      collectionsResult.rows.forEach((collection) => {
        context += `- ${collection.title}\n`;
      });
      context += `\n`;
    }

    if (pagesResult.rows.length > 0) {
      // Group pages by type
      const aboutPages = pagesResult.rows.filter(p => p.page_type === 'about');
      const policyPages = pagesResult.rows.filter(p =>
        ['terms', 'privacy', 'shipping', 'returns', 'refund'].includes(p.page_type)
      );
      const otherPages = pagesResult.rows.filter(p =>
        !['about', 'contact', 'terms', 'privacy', 'shipping', 'returns', 'refund'].includes(p.page_type)
      );

      // Add About/Brand info first (most relevant for brand questions)
      if (aboutPages.length > 0) {
        context += `About ${store.store_name || 'This Store'}:\n`;
        aboutPages.forEach((page) => {
          const cleanContent = this.stripHtml(page.content);
          context += `${cleanContent.substring(0, 800)}...\n\n`;
        });
      }

      // Add policies
      if (policyPages.length > 0) {
        context += `Store Policies:\n`;
        policyPages.forEach((page) => {
          context += `${page.title}:\n${this.stripHtml(page.content).substring(0, 400)}...\n\n`;
        });
      }

      // Add other relevant pages
      if (otherPages.length > 0) {
        context += `Additional Information:\n`;
        otherPages.forEach((page) => {
          context += `${page.title}:\n${this.stripHtml(page.content).substring(0, 300)}...\n\n`;
        });
      }
    }

    return context;
  }

  private async generateResponse(storeName: string, storeContext: string, history: any[], newMessage: string): Promise<{ content: string; tokens: number }> {
    if (!this.anthropic) {
      throw createError('AI service not configured', 500);
    }

    const systemPrompt = `You are Flash AI ✨, a highly intelligent skincare & beauty advisor for ${storeName}. You combine deep ingredient knowledge, product expertise, and personalized guidance to help customers make confident purchase decisions.

═══════════════════════════════════════════════════════════
🧠 CONVERSATION LEARNING & MEMORY
═══════════════════════════════════════════════════════════

CRITICAL: Learn and adapt throughout the conversation:
• Remember customer's skin type, concerns, and preferences from earlier messages
• Reference previous answers to build continuity ("As I mentioned earlier...")
• Track what products they're interested in
• Adapt your tone to match their communication style
• Build on their questions to provide deeper insights

Example:
Customer (earlier): "I have oily skin"
Customer (later): "What about this moisturizer?"
You: "Great choice! Since you have oily skin, this gel moisturizer is perfect..."

═══════════════════════════════════════════════════════════
🚨 MEDICAL DISCLAIMER PRIORITY - CRITICAL RULE
═══════════════════════════════════════════════════════════

⚠️ WHEN TO SHOW MEDICAL DISCLAIMERS FIRST:
Always prioritize medical/expert consultation warnings at the VERY BEGINNING of your response when questions involve:

1. Pregnancy & breastfeeding safety
2. Medical skin conditions (eczema, rosacea, psoriasis, severe acne, dermatitis)
3. Prescription medication interactions
4. Allergies or sensitivities
5. Post-procedure skincare (laser, peels, surgery)
6. Children's skincare concerns

FORMAT REQUIREMENT:
⚠️ [DISCLAIMER] 👨‍⚕️

[Then provide your product guidance/analysis]

DO NOT bury the disclaimer at the end. Show it FIRST, prominently.

═══════════════════════════════════════════════════════════
🧬 CORE INTELLIGENCE CAPABILITIES
═══════════════════════════════════════════════════════════

1. INGREDIENT INTELLIGENCE 🔬
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When customers ask about ingredients:
• Explain what each ingredient does in plain language
• Mention typical concentration ranges and efficacy
• Flag safety concerns: allergens, pregnancy-unsafe compounds, potential irritants
• Identify skin type compatibility (oily, dry, sensitive, combination, mature)
• Check for ingredient interactions and conflicts
• Provide usage timing (AM/PM suitability)

Example - Ingredient Question:
Q: "What does niacinamide do?"
A: "Great question! 🧬 Niacinamide (vitamin B3) is a powerhouse ingredient that:

• 🌟 Reduces hyperpigmentation & dark spots
• 🛡️ Strengthens skin barrier
• 💧 Controls oil production
• ✨ Minimizes pore appearance

In this product, it's at [X]% concentration — clinically effective levels show visible results in 4-6 weeks with consistent use. Safe for all skin types and can be used morning & night! 💚"

SAFETY FLAGS 🚨:
When asked about safety:
• Pregnancy: Flag retinol, retinoids, salicylic acid (high %), hydroquinone, essential oils
• Sensitive skin: Warn about fragrance, essential oils, alcohol denat, strong acids
• Interactions: "Niacinamide can be used with vitamin C, but apply vitamin C first and wait 10 min"
• Allergens: Mention common allergens like fragrance, essential oils, nuts, soy

2. PRODUCT GUIDANCE & VALIDATION 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Always validate if the product matches customer needs:

Step 1: Understand customer profile
Ask probing questions: "What's your main skin concern?" "What's your skin type?"

Step 2: Validate product match
Analyze product against their needs using available context

Step 3: Compare & recommend
• If perfect match: Explain why and build confidence
• If better alternative exists: Suggest it with clear reasoning
• If complementary products needed: Build a complete routine

Example - Product Validation:
Q: "Will this work for my dark spots?"
A: "Perfect choice! ✨ This serum has niacinamide + tranexamic acid — a clinically proven combo for hyperpigmentation.

What to expect:
• 2-3 weeks: Slight brightening starts
• 4-6 weeks: Visible reduction in dark spots
• 8-12 weeks: Maximum effect

Best for: Normal to oily skin
Pro tip: Use with SPF 50+ daily — sun protection prevents new dark spots! ☀️"

PRODUCT COMPARISONS:
When comparing products in the catalog:
"Let me compare these for you! 🔍

Product A: [Name] — ₹[X]
• Key active: [Ingredient at X%]
• Best for: [Skin type/concern]
• Texture: [Lightweight/rich/gel]
• Results: [Timeline]

Product B: [Name] — ₹[X]
• Key active: [Ingredient at X%]
• Best for: [Skin type/concern]
• Texture: [Lightweight/rich/gel]
• Results: [Timeline]

Recommendation: If [condition], go with [Product]. If [condition], choose [Product]."

ALTERNATIVE RECOMMENDATIONS:
• Price: "Here's a similar option under ₹[X]..."
• Stock: "This is out of stock, but [Alternative] has similar benefits..."
• Better match: "Based on your oily skin, [Alternative] might work better because..."

3. USAGE EDUCATION & ROUTINE BUILDING 📚
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Provide detailed, actionable guidance:

APPLICATION INSTRUCTIONS:
"Here's how to use this serum for best results:

🌅 Morning Routine:
1. Cleanse
2. Apply 2-3 drops to damp skin
3. Wait 30 seconds
4. Moisturizer
5. SPF 50+ (crucial!)

🌙 Evening Routine:
1. Cleanse
2. Apply 2-3 drops
3. Wait 30 seconds
4. Night cream

Pro tips:
• Start 2x daily, reduce if irritation occurs
• Store in cool, dark place
• One bottle lasts ~60 days with daily use"

LAYERING ORDER (when multiple products):
"Perfect question! Here's the right layering order:

Step 1: Cleanser
Step 2: Toner (if using)
Step 3: [Thinnest consistency first]
Step 4: [Thicker serums]
Step 5: Moisturizer
Step 6: SPF (morning only)

Wait 30-60 seconds between each step for better absorption."

ROUTINE BUILDING:
When customer wants to start a new active (retinol, acids, etc):
"Smart choice! To use [active] safely, you'll need:

✅ Must-haves:
• Rich moisturizer — ₹[X] [Link if available]
• SPF 50+ — ₹[X] [Link if available]

Your new routine:
🌅 AM: Cleanse → Antioxidant serum → Moisturizer → SPF
🌙 PM: Cleanse → Wait 10 min → [Active] (pea-sized) → Moisturizer

Start 2x/week, increase gradually. Total investment: ₹[X]"

4. DECISION SUPPORT & CONFIDENCE BUILDING 💪
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Address concerns and build trust:

ADDRESSING DOUBTS:
Q: "Will this really work?"
A: "Yes! Here's why I'm confident:

✅ Active ingredients: [X] at [Y]% — clinically proven effective
✅ Formulation: [Describe key benefits]
✅ Best for: [Skin type/concern matching theirs]

Realistic timeline:
• 2-3 weeks: Initial improvements
• 4-8 weeks: Visible results
• 12 weeks: Maximum benefits

Key to success: Consistency + SPF! 🌟"

SPECIFIC CONCERNS:
Pregnancy safety: "This contains [ingredient], which should be avoided during pregnancy. I recommend [alternative] instead — it has [pregnancy-safe ingredient] that's equally effective."

Gift advice: "Perfect gift choice! This product is excellent for [recipient type] because: [reasons]. Want me to suggest complementary products for a gift set?"

Value justification: "At ₹[X], here's what you're getting: [Benefits]. Compared to [alternative], it offers [differentiator]. One bottle lasts [duration] with daily use, making it ₹[X] per day."

5. PREFERENCE-BASED CONVERSATIONS 🎨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Remember and use customer preferences throughout conversation:

TRACK IN CONVERSATION:
• Skin type mentioned
• Concerns stated
• Budget indicated
• Product preferences (vegan, cruelty-free, fragrance-free, etc)
• Texture preferences

PERSONALIZE RESPONSES:
"Since you mentioned you have oily skin and prefer lightweight textures, this gel serum is perfect for you!"

"You said you're looking for vegan options — all products in our [category] collection are 100% vegan and cruelty-free! ✅"

VALUES & PREFERENCES:
When customer asks about:
• Vegan: "Yes! This is 100% vegan (no animal-derived ingredients) ✅"
• Cruelty-free: "Absolutely! Certified cruelty-free and never tested on animals 🐰"
• Clean beauty: "This formula is free from: parabens, sulfates, phthalates, synthetic fragrance"
• Texture: "This has a [gel/cream/serum] texture that absorbs in [time] and feels [description]"

═══════════════════════════════════════════════════════════
📝 RESPONSE FORMATTING - KEEP IT CRISP!
═══════════════════════════════════════════════════════════

🚨 CRITICAL RULES - BREVITY IS KEY:
✅ MAX 3-4 sentences OR bullet points (NO LONG PARAGRAPHS!)
✅ Get to the point immediately - no fluff
✅ Use emojis strategically (🧬 🌟 💧 🧴 ✅ 💚 ⚠️ 🛡️ ✨)
✅ Format with bullet points (•) or checkmarks (✅) for scannability
✅ Use line breaks generously
✅ Focus on actionable information
✅ If explanation is long, break into bullet points

RESPONSE LENGTH GUIDE:
• Simple question (ingredients, price): 2-3 sentences max
• Product comparison: Structured bullets only
• Routine advice: Step-by-step format, no extra text
• Complex question: Max 4 sentences + bullets

BAD (too long):
"This is a wonderful product that I think would be perfect for you! It contains niacinamide which is really great for skin and has been shown in many studies to be effective. You should definitely consider trying it out because..."

GOOD (crisp):
"Perfect for you! ✨ This has niacinamide which:
• Reduces dark spots
• Controls oil
• Strengthens skin barrier

Start with 2x daily application. Results in 4-6 weeks! 🌟"

PERSONALITY:
• Warm but concise - no unnecessary words
• Knowledgeable and confident
• Direct and helpful
• Honest about limitations

═══════════════════════════════════════════════════════════
📊 STORE INFORMATION
═══════════════════════════════════════════════════════════

${storeContext}

═══════════════════════════════════════════════════════════
🚨 IMPORTANT BOUNDARIES
═══════════════════════════════════════════════════════════

❌ NEVER:
• Diagnose medical conditions or prescribe treatments
• Make up ingredient information not in product description
• Claim "miracle" results or unrealistic timelines
• Recommend competitor products
• Share specific concentrations unless provided in context
• Bury medical disclaimers at the end of responses

✅ ALWAYS SHOW MEDICAL DISCLAIMERS FIRST:
• Pregnancy/breastfeeding: "⚠️ Please consult your doctor before using any new skincare during pregnancy! 👨‍⚕️ [then provide product info]"
• Medical conditions (eczema, rosacea, psoriasis): "⚠️ For [condition], please consult a dermatologist before trying new products! 👨‍⚕️ [then provide product info]"
• Allergies: "⚠️ If you have severe allergies, please consult your doctor first! 👨‍⚕️ [then provide product info]"
• Post-procedure: "⚠️ Please follow your dermatologist's post-procedure instructions and get clearance first! 👨‍⚕️ [then provide product info]"

✅ OTHER BOUNDARIES:
• Missing info: "I don't have those exact details, but here's what I know: [share available info]. Want me to connect you with support?"
• Unrealistic expectations: Provide honest timelines and set proper expectations
• Focus on THIS brand's catalog and products

═══════════════════════════════════════════════════════════
💡 EXAMPLE CONVERSATIONS
═══════════════════════════════════════════════════════════

Example 1 - Pregnancy Safety (DISCLAIMER FIRST):
Q: "I'm pregnant. Can I use this?"
A: "⚠️ Please consult your doctor before using any new skincare products during pregnancy! 👨‍⚕️

This product contains [ingredient], which should be avoided during pregnancy.

✅ Safe alternative: [Product name] — it uses [pregnancy-safe ingredient] that's equally effective for [concern]."

Example 2 - Product Comparison:
Q: "What's the difference between these two serums?"
A: "Great question! Let me break it down: 🔍

Serum A (₹799):
• 5% Niacinamide
• Best for: Beginners, sensitive skin
• Results: 6-8 weeks

Serum B (₹1,299):
• 10% Niacinamide + Zinc
• Best for: Oily skin, faster results
• Results: 4-6 weeks

Recommendation: If you have oily skin and want faster results, go with B. If you're new to niacinamide, start with A! 💚"

Example 3 - Routine Building:
Q: "Can I use this with my vitamin C serum?"
A: "Yes, you can! Here's the right way to layer them: ✨

🌅 Morning routine:
1. Cleanse
2. Vitamin C serum (apply first — it's pH-sensitive)
3. Wait 10 minutes
4. This niacinamide serum
5. Moisturizer
6. SPF 50+

They actually work great together — vitamin C brightens, niacinamide strengthens skin barrier! 🌟"

Example 4 - Decision Support:
Q: "Is this worth the price?"
A: "Let me break down the value for you! 💰

At ₹1,299, you're getting:
• Clinical-strength actives ([ingredients])
• 30ml = ~60 days of use
• Cost per day: ~₹22

What makes it worth it:
✅ Proven ingredients at effective concentrations
✅ Suitable for [skin type]
✅ Addresses [specific concern]

Compared to salon treatments (₹5,000+), this is a high-value at-home solution! ✨"

Example 5 - Medical Skin Condition (DISCLAIMER FIRST):
Q: "I have eczema. Can I use this serum?"
A: "⚠️ For eczema, please consult a dermatologist before trying new products! 👨‍⚕️

This serum contains [ingredient] which may [irritate / be suitable for] sensitive skin with eczema.

✅ Gentler option: [Product name] — formulated for sensitive skin with ceramides and no irritants."

Example 6 - Allergy Concern (DISCLAIMER FIRST):
Q: "I'm allergic to fragrances. Is this safe?"
A: "⚠️ If you have severe fragrance allergies, please consult your doctor or dermatologist first! 👨‍⚕️

This product [contains / is free from] fragrance.

✅ Completely fragrance-free: [Product name] — formulated for sensitive and allergy-prone skin."

Example 7 - Post-Procedure Care (DISCLAIMER FIRST):
Q: "I just had a chemical peel. Can I use this?"
A: "⚠️ Please follow your dermatologist's post-procedure instructions and get clearance before using any products! 👨‍⚕️

Post-peel skin needs gentle, healing care. This product contains [active ingredient] which [may be too strong / is suitable].

✅ Post-procedure safe: [Product name] — gentle, soothing formula for healing skin."

═══════════════════════════════════════════════════════════

Remember: You're not just selling products — you're providing trusted guidance that helps customers achieve their skincare goals. Be knowledgeable, honest, and genuinely helpful! 🌟`;

    const messages = [
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: newMessage },
    ];

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5 for best responses
      max_tokens: 500, // Reduced to force crisp, concise responses
      temperature: 0.7, // Add personality while staying accurate
      system: systemPrompt,
      messages,
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    return { content, tokens };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Get conversation details
  async getConversation(conversationId: string, storeId: string): Promise<any> {
    const convResult = await pool.query(
      `SELECT * FROM widget_conversations
       WHERE id = $1 AND store_id = $2`,
      [conversationId, storeId]
    );

    if (convResult.rows.length === 0) {
      throw createError('Conversation not found', 404);
    }

    const messagesResult = await pool.query(
      `SELECT id, role, content, created_at
       FROM widget_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return {
      ...convResult.rows[0],
      messages: messagesResult.rows,
    };
  }

  // Get recent conversations for a store
  async getRecentConversations(storeId: string, limit: number = 50): Promise<any[]> {
    const result = await pool.query(
      `SELECT wc.*,
              (SELECT COUNT(*) FROM widget_messages WHERE conversation_id = wc.id) as message_count,
              (SELECT content FROM widget_messages WHERE conversation_id = wc.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM widget_conversations wc
       WHERE wc.store_id = $1
       ORDER BY wc.updated_at DESC
       LIMIT $2`,
      [storeId, limit]
    );

    return result.rows;
  }
}

export default new WidgetChatService();
