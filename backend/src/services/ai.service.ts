import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  conversationId?: string;
  message: string;
  userId: string;
  teamId?: string;
  model?: string;
}

interface ChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  model: string;
  tokens: number;
}

export class AIService {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;

  constructor() {
    // Initialize Anthropic if API key exists
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    // Initialize OpenAI if API key exists
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { conversationId, message, userId, teamId, model = 'claude-3-sonnet' } = request;

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = await this.createConversation(userId, teamId, model);
    }

    // Get conversation history
    const history = await this.getConversationHistory(convId);

    // Save user message
    const userMessageId = await this.saveMessage(convId, 'user', message);

    // Generate AI response
    let aiResponse: string;
    let tokens = 0;

    if (model.startsWith('claude')) {
      const result = await this.chatWithClaude(history, message, model);
      aiResponse = result.content;
      tokens = result.tokens;
    } else if (model.startsWith('gpt')) {
      const result = await this.chatWithOpenAI(history, message, model);
      aiResponse = result.content;
      tokens = result.tokens;
    } else {
      throw createError('Unsupported AI model', 400);
    }

    // Save AI message
    const aiMessageId = await this.saveMessage(convId, 'assistant', aiResponse, tokens, model);

    // Update conversation token count
    await this.updateConversationTokens(convId, tokens);

    return {
      conversationId: convId,
      messageId: aiMessageId,
      content: aiResponse,
      model,
      tokens,
    };
  }

  private async chatWithClaude(
    history: ChatMessage[],
    newMessage: string,
    model: string
  ): Promise<{ content: string; tokens: number }> {
    if (!this.anthropic) {
      throw createError('Anthropic API key not configured', 500);
    }

    const modelMap: Record<string, string> = {
      'claude-3-opus': 'claude-3-haiku-20240307', // API key only has access to Haiku
      'claude-3-sonnet': 'claude-3-haiku-20240307', // API key only has access to Haiku
      'claude-3-haiku': 'claude-3-haiku-20240307',
    };

    const messages = [
      ...history.filter(m => m.role !== 'system').map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: newMessage },
    ];

    const response = await this.anthropic.messages.create({
      model: modelMap[model] || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages,
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const tokens = response.usage.input_tokens + response.usage.output_tokens;

    return { content, tokens };
  }

  private async chatWithOpenAI(
    history: ChatMessage[],
    newMessage: string,
    model: string
  ): Promise<{ content: string; tokens: number }> {
    if (!this.openai) {
      throw createError('OpenAI API key not configured', 500);
    }

    const messages = [
      ...history.map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: newMessage },
    ];

    const response = await this.openai.chat.completions.create({
      model: model === 'gpt-4' ? 'gpt-4-turbo-preview' : 'gpt-3.5-turbo',
      messages: messages as any,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content || '';
    const tokens = response.usage?.total_tokens || 0;

    return { content, tokens };
  }

  private async createConversation(userId: string, teamId: string | undefined, model: string): Promise<string> {
    const result = await pool.query(
      `INSERT INTO conversations (user_id, team_id, model, title)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, teamId || null, model, 'New Conversation']
    );
    return result.rows[0].id;
  }

  private async getConversationHistory(conversationId: string): Promise<ChatMessage[]> {
    const result = await pool.query(
      `SELECT role, content
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 50`,
      [conversationId]
    );

    return result.rows.map(row => ({
      role: row.role,
      content: row.content,
    }));
  }

  private async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokens: number = 0,
    model?: string
  ): Promise<string> {
    const result = await pool.query(
      `INSERT INTO messages (conversation_id, role, content, tokens, model)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [conversationId, role, content, tokens, model]
    );
    return result.rows[0].id;
  }

  private async updateConversationTokens(conversationId: string, tokens: number): Promise<void> {
    await pool.query(
      `UPDATE conversations
       SET total_tokens = total_tokens + $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [tokens, conversationId]
    );
  }

  async getConversations(userId: string, teamId?: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT id, title, model, total_tokens, is_archived, created_at, updated_at
       FROM conversations
       WHERE user_id = $1 AND ($2::uuid IS NULL OR team_id = $2)
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId, teamId || null]
    );
    return result.rows;
  }

  async getConversation(conversationId: string, userId: string): Promise<any> {
    const convResult = await pool.query(
      `SELECT id, title, model, total_tokens, is_archived, created_at, updated_at
       FROM conversations
       WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (convResult.rows.length === 0) {
      throw createError('Conversation not found', 404);
    }

    const messagesResult = await pool.query(
      `SELECT id, role, content, tokens, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return {
      ...convResult.rows[0],
      messages: messagesResult.rows,
    };
  }

  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM conversations
       WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (result.rowCount === 0) {
      throw createError('Conversation not found', 404);
    }
  }

  async updateConversationTitle(conversationId: string, userId: string, title: string): Promise<void> {
    const result = await pool.query(
      `UPDATE conversations
       SET title = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [title, conversationId, userId]
    );

    if (result.rowCount === 0) {
      throw createError('Conversation not found', 404);
    }
  }
}

export default new AIService();
