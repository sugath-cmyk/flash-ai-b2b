import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import Anthropic from '@anthropic-ai/sdk';

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

    // Save user message
    await this.saveMessage(convId, storeId, 'user', message);

    // Get store context (products, info, etc.)
    const storeContext = await this.getStoreContext(storeId, productContext);

    // Get conversation history
    const history = await this.getConversationHistory(convId);

    // Generate AI response with store context
    const aiResponse = await this.generateResponse(storeContext, history, message);

    // Save AI response
    await this.saveMessage(convId, storeId, 'assistant', aiResponse.content, aiResponse.tokens);

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
       LIMIT 20`,
      [conversationId]
    );

    return result.rows;
  }

  private async saveMessage(
    conversationId: string,
    storeId: string,
    role: 'user' | 'assistant',
    content: string,
    tokens?: number
  ): Promise<void> {
    await pool.query(
      `INSERT INTO widget_messages (conversation_id, store_id, role, content, model, tokens)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [conversationId, storeId, role, content, role === 'assistant' ? 'claude-3-haiku' : null, tokens || null]
    );
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

    // Get top products
    const productsResult = await pool.query(
      `SELECT title, description, short_description, price, product_type, vendor
       FROM extracted_products
       WHERE store_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 20`,
      [storeId]
    );

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
        context += `${idx + 1}. ${product.title} - $${product.price}`;
        if (product.short_description) {
          context += ` - ${product.short_description}`;
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
      const policies = pagesResult.rows.filter(p =>
        ['terms', 'privacy', 'shipping', 'returns', 'refund'].includes(p.page_type)
      );

      if (policies.length > 0) {
        context += `Store Policies:\n`;
        policies.forEach((page) => {
          context += `${page.title}:\n${this.stripHtml(page.content).substring(0, 500)}...\n\n`;
        });
      }
    }

    return context;
  }

  private async generateResponse(storeContext: string, history: any[], newMessage: string): Promise<{ content: string; tokens: number }> {
    if (!this.anthropic) {
      throw createError('AI service not configured', 500);
    }

    const systemPrompt = `You are Flash AI, a helpful shopping assistant for this e-commerce store. Your primary goal is to help customers learn about products, make informed purchase decisions, and answer store-related questions.

Store Information:
${storeContext}

IMPORTANT BOUNDARIES - You MUST follow these rules:
1. ONLY answer questions related to:
   - Products in this store (features, ingredients, pricing, availability, usage, benefits, comparisons)
   - Store policies (shipping, returns, refunds, terms, privacy)
   - Order process and payment methods
   - General shopping advice related to these products

2. POLITELY DECLINE questions about:
   - Unrelated topics (news, politics, general knowledge, other websites)
   - Medical advice (instead suggest: "Please consult a healthcare professional")
   - Personal information requests
   - Competitor products not sold in this store
   - Anything outside the scope of this store's products and policies

3. Response Guidelines:
   - Keep responses concise (2-4 sentences for simple questions)
   - Use bullet points for ingredient lists or feature lists
   - For product recommendations, mention 2-3 specific products with prices
   - If you don't have information, say: "I don't have that specific information, but you can contact customer support at [store contact]"
   - Never make up product information - only use the store context provided
   - Always be friendly, professional, and helpful

4. When asked off-topic questions, respond like this:
   "I'm Flash AI, your shopping assistant for ${storeContext.split('\n')[0]}. I can help you with questions about our products, store policies, and shopping here. How can I assist you with your shopping today?"

Remember: You are here to help customers shop confidently at this store!`;

    const messages = [
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: newMessage },
    ];

    const response = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
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
