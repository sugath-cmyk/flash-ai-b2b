import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../config/database';

/**
 * Skincare AI Expert Service
 * A conversational AI that analyzes face scans and asks adaptive questions
 * to understand the user's skin deeply before revealing analysis results.
 */

interface FaceScanAnalysis {
  skinTone?: string;
  skinUndertone?: string;
  skinScore?: number;
  acneScore?: number;
  wrinkleScore?: number;
  pigmentationScore?: number;
  hydrationScore?: number;
  textureScore?: number;
  rednessScore?: number;
  darkCirclesScore?: number;
  poreScore?: number;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SkincareConversationContext {
  scanId: string;
  visitorId: string;
  storeId: string;
  analysis: FaceScanAnalysis;
  conversationHistory: ConversationMessage[];
  userAge?: number;
  questionPhase: 'age' | 'routine' | 'foundational' | 'habits' | 'lifestyle' | 'summary';
  collectedInfo: Record<string, any>;
}

// System prompt for the Skincare Expert AI
const SKINCARE_EXPERT_SYSTEM_PROMPT = `# SKIN CARE EXPERT AI

## Role & Identity

You are a senior skin care expert AI combining the knowledge of a dermatologist, cosmetic chemist, skin physiologist, and clinical esthetician.
Your goal is to understand the user's skin deeply, identify probable root causes, and guide them toward safe, effective, personalized care.

You do not give medical diagnoses. You explain likelihoods, reasoning, and trade-offs clearly.

## Core Inputs You Receive

- Facial scan data with skin surface signals: tone, redness, texture, pore visibility, pigmentation patterns, hydration, and various scores
- User responses during conversation
- Environmental context (if available): climate, season

## Primary Objective

1. Analyze the facial scan to detect visible patterns and anomalies.
2. Ask adaptive, high-signal questions to uncover invisible root causes.
3. Build a probabilistic understanding of the user's skin, not absolute conclusions.
4. Continuously refine understanding through conversation.

## Conversation Opening (Mandatory)

Always begin with:

"Before I analyze your skin in detail, I need to understand you a bit.
Let's start simple — how old are you?"

Age is a non-negotiable first question because it affects:
- Sebum activity
- Collagen production
- Pigmentation behavior
- Healing speed
- Hormonal influence

## Face Scan Analysis Rules

When observing the scan data:
- Do not label conditions immediately
- First describe what you see, neutrally:
  - "I'm noticing uneven texture around the cheeks"
  - "There's mild redness around the nose"
- Mentally map observations to:
  - Barrier health
  - Inflammation
  - Pigmentation type
  - Oil vs dehydration signals
  - Structural aging
- Use facial regions independently:
  - Forehead ≠ cheeks ≠ jaw ≠ under-eye

## Questioning Framework (Adaptive)

### 1. Foundational Questions (After Age)
Ask only what is necessary, based on scan signals:
- Skin feel after washing (tight, oily, normal)
- Breakout patterns (location, frequency)
- Sensitivity or stinging
- Scalp conditions (dandruff, itchiness)
- Sun exposure habits
- Sleep quality

Example: "Do you notice flakes on your scalp or around your eyebrows?"

### 2. Habit & Usage Probing
Only ask when relevant:
- Phone usage against face
- Hair oil / conditioner touching skin
- Pillowcase washing frequency
- Over-exfoliation habits
- Product switching behavior

### 3. Current Skincare Routine (MANDATORY - ask early after foundational questions)
This is critical for understanding their current care and ingredient usage:
- "What does your current skincare routine look like? Walk me through your AM and PM steps."
- "What products are you using right now? Any specific brands?"
- Ask about cleansers, serums, moisturizers, SPF separately if needed
- "How long have you been using these products?"

Example probes:
- "Are you currently using any serums or treatments?"
- "What cleanser do you use? How does your skin feel after?"
- "Do you use sunscreen daily? What brand/SPF?"

### 4. Ingredient & Active Awareness
Probe gently based on their routine:
- "Are you using actives like retinol or exfoliating acids?"
- "How often do you use them?"
- "Do you layer multiple actives together?"
- If they mention brands, ask about specific products from that brand

### 5. Lifestyle & Systemic Signals
When patterns suggest it:
- Stress levels
- Sleep debt
- Menstrual or hormonal changes
- Diet triggers (not moralized)

## Reasoning Rules

- Always explain why you're asking a question
- Connect behavior → biology → skin outcome
- Use probability language:
  - "This could be contributing…"
  - "One likely reason is…"
- If uncertain, say so transparently

## Ingredient-Level Reasoning

When recommending or warning:
- Reference ingredient function
- Mention concentration sensitivity
- Account for climate and tolerance
- Flag interactions and overuse risks

## Output Style

- Calm, precise, non-judgmental
- Educational, not prescriptive
- No fear-based language
- Avoid buzzwords unless explained
- Keep responses concise (2-4 sentences per turn)
- Ask ONE question at a time

## Safety & Boundaries

- Do not diagnose diseases
- Escalate to a dermatologist if:
  - Persistent pain
  - Bleeding lesions
  - Sudden severe changes
- Clearly state limitations

## Root Cause Analysis Categories

You should consider these areas when analyzing:

1. **Inflammation Spectrum**: Redness, flushing, burning, stinging, sensitivity
2. **Pigmentation Issues**: Melasma, PIH, uneven tone, periorbital darkness
3. **Texture & Structure**: Roughness, enlarged pores, fine lines, crepey skin
4. **Sebum Regulation**: Excess oil, oil + dehydration paradox, sebaceous filaments
5. **Microbiome/Fungal**: Fungal acne, perioral dermatitis, scalp–face transfer
6. **Barrier Function**: Tightness, flaking, sensitivity, product separation
7. **Lifestyle Factors**: Sleep, stress, dehydration, nutrient deficiencies
8. **Usage Habits**: Phone contact, picking, mask friction, product switching
9. **Environmental**: UV, pollution, humidity, AC exposure, seasons

## Conversation Flow

1. Start with mandatory age question
2. Ask about their current skincare routine and products they use (MANDATORY)
3. Based on scan data and routine, ask 2-3 more targeted questions (one at a time)
4. Connect observations to potential root causes, referencing their routine
5. When you have enough information (typically after 5-7 exchanges), indicate you're ready to share your analysis
6. End with: "I now have a good understanding of your skin and routine. Ready to see your personalized analysis?"

## Information to Collect

Throughout the conversation, aim to understand:
- Age (mandatory first question)
- Current AM routine (cleanser, serum, moisturizer, SPF)
- Current PM routine (cleansing, treatments, moisturizer)
- Brands they currently use
- Any actives (retinol, AHAs, BHAs, Vitamin C, etc.)
- How long they've been using current products
- Any recent changes to their routine
- Products that work well for them
- Products that caused reactions

## Important

- NEVER reveal the numerical scores directly - describe them qualitatively
- NEVER dump all information at once - ask questions conversationally
- ALWAYS wait for user response before asking next question
- Keep each response under 100 words
- Be warm and professional, like a caring skin expert`;

class SkincareAIService {
  private anthropic: Anthropic | null = null;
  private conversations: Map<string, SkincareConversationContext> = new Map();

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Start a new skincare consultation conversation
   */
  async startConversation(
    scanId: string,
    visitorId: string,
    storeId: string
  ): Promise<{ conversationId: string; message: string }> {
    // Fetch the face scan analysis from database
    const analysis = await this.getFaceScanAnalysis(scanId);

    if (!analysis) {
      throw new Error('Face scan analysis not found');
    }

    // Create conversation context
    const conversationId = `skincare_${scanId}_${Date.now()}`;
    const context: SkincareConversationContext = {
      scanId,
      visitorId,
      storeId,
      analysis,
      conversationHistory: [],
      questionPhase: 'age',
      collectedInfo: {},
    };

    this.conversations.set(conversationId, context);

    // Generate opening message from AI
    const openingMessage = await this.generateAIResponse(conversationId, null);

    return {
      conversationId,
      message: openingMessage,
    };
  }

  /**
   * Continue conversation with user message
   */
  async continueConversation(
    conversationId: string,
    userMessage: string
  ): Promise<{ message: string; isComplete: boolean; canRevealResults: boolean }> {
    const context = this.conversations.get(conversationId);
    if (!context) {
      throw new Error('Conversation not found');
    }

    // Add user message to history
    context.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Extract age if in age phase
    if (context.questionPhase === 'age') {
      const ageMatch = userMessage.match(/\d+/);
      if (ageMatch) {
        context.userAge = parseInt(ageMatch[0], 10);
        context.questionPhase = 'routine'; // Move to routine questions after age
        context.collectedInfo.age = context.userAge;
      }
    }

    // Generate AI response
    const aiResponse = await this.generateAIResponse(conversationId, userMessage);

    // Check if conversation should end
    const isComplete = this.shouldEndConversation(context);
    const canRevealResults = context.conversationHistory.length >= 6;

    return {
      message: aiResponse,
      isComplete,
      canRevealResults,
    };
  }

  /**
   * Get the collected user information from conversation
   */
  getCollectedInfo(conversationId: string): Record<string, any> | null {
    const context = this.conversations.get(conversationId);
    return context?.collectedInfo || null;
  }

  /**
   * End conversation and clean up
   */
  endConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  private async getFaceScanAnalysis(scanId: string): Promise<FaceScanAnalysis | null> {
    try {
      const result = await pool.query(
        `SELECT
          fa.skin_tone,
          fa.skin_undertone,
          fa.skin_score,
          fa.acne_score,
          fa.wrinkle_score,
          fa.pigmentation_score,
          fa.hydration_score,
          fa.hydration_level,
          fa.texture_score,
          fa.redness_score,
          fa.under_eye_darkness,
          fa.pore_size_average,
          fa.oiliness_score,
          fa.sensitivity_level
        FROM face_analysis fa
        WHERE fa.face_scan_id = $1`,
        [scanId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        skinTone: row.skin_tone,
        skinUndertone: row.skin_undertone,
        skinScore: row.skin_score,
        acneScore: row.acne_score,
        wrinkleScore: row.wrinkle_score,
        pigmentationScore: row.pigmentation_score,
        hydrationScore: row.hydration_score,
        textureScore: row.texture_score,
        rednessScore: row.redness_score,
        darkCirclesScore: row.under_eye_darkness,
        poreScore: row.pore_size_average ? Math.round(row.pore_size_average * 100) : undefined,
      };
    } catch (error) {
      console.error('Error fetching face scan analysis:', error);
      return null;
    }
  }

  private async generateAIResponse(
    conversationId: string,
    userMessage: string | null
  ): Promise<string> {
    const context = this.conversations.get(conversationId);
    if (!context) {
      throw new Error('Conversation not found');
    }

    if (!this.anthropic) {
      // Fallback if no API key - return a default message
      if (userMessage === null) {
        return "Before I analyze your skin in detail, I need to understand you a bit. Let's start simple — how old are you?";
      }
      return "Thank you for sharing. Based on your skin scan, I can see some interesting patterns. Ready to see your personalized analysis?";
    }

    // Build context message with scan data
    const scanContext = this.buildScanContext(context.analysis);

    // Build messages for Claude
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    // Add conversation history
    for (const msg of context.conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // If this is the start, add a trigger message
    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: 'Start the skincare consultation.',
      });
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        system: `${SKINCARE_EXPERT_SYSTEM_PROMPT}\n\n## Current Face Scan Data\n${scanContext}\n\n## Conversation Progress\nQuestions asked: ${context.conversationHistory.length}\nUser age: ${context.userAge || 'Not yet collected'}\nPhase: ${context.questionPhase}`,
        messages,
      });

      const aiMessage = response.content[0].type === 'text' ? response.content[0].text : '';

      // Add AI response to history
      context.conversationHistory.push({
        role: 'assistant',
        content: aiMessage,
      });

      return aiMessage;
    } catch (error) {
      console.error('Error generating AI response:', error);
      // Fallback response
      return "Thank you for that information. I'm building a picture of your skin. Ready to see your personalized analysis?";
    }
  }

  private buildScanContext(analysis: FaceScanAnalysis): string {
    const lines: string[] = [];

    if (analysis.skinTone) {
      lines.push(`Skin Tone: ${analysis.skinTone}`);
    }
    if (analysis.skinUndertone) {
      lines.push(`Undertone: ${analysis.skinUndertone}`);
    }
    if (analysis.skinScore !== undefined) {
      lines.push(`Overall Skin Health: ${this.scoreToDescription(analysis.skinScore)}`);
    }
    if (analysis.acneScore !== undefined) {
      lines.push(`Acne Presence: ${this.scoreToDescription(analysis.acneScore, true)}`);
    }
    if (analysis.wrinkleScore !== undefined) {
      lines.push(`Fine Lines/Wrinkles: ${this.scoreToDescription(analysis.wrinkleScore, true)}`);
    }
    if (analysis.pigmentationScore !== undefined) {
      lines.push(`Pigmentation Irregularity: ${this.scoreToDescription(analysis.pigmentationScore, true)}`);
    }
    if (analysis.hydrationScore !== undefined) {
      lines.push(`Hydration Level: ${this.scoreToDescription(analysis.hydrationScore)}`);
    }
    if (analysis.textureScore !== undefined) {
      lines.push(`Skin Texture: ${this.scoreToDescription(analysis.textureScore)}`);
    }
    if (analysis.rednessScore !== undefined) {
      lines.push(`Redness/Inflammation: ${this.scoreToDescription(analysis.rednessScore, true)}`);
    }
    if (analysis.darkCirclesScore !== undefined) {
      lines.push(`Under-eye Darkness: ${this.scoreToDescription(analysis.darkCirclesScore, true)}`);
    }
    if (analysis.poreScore !== undefined) {
      lines.push(`Pore Visibility: ${this.scoreToDescription(analysis.poreScore, true)}`);
    }

    return lines.join('\n');
  }

  private scoreToDescription(score: number, inverseScale: boolean = false): string {
    // For inverse scale (higher = worse): acne, wrinkles, pigmentation, redness, dark circles, pores
    // For normal scale (higher = better): skin health, hydration, texture
    const normalizedScore = inverseScale ? 100 - score : score;

    if (normalizedScore >= 80) return 'Excellent';
    if (normalizedScore >= 60) return 'Good';
    if (normalizedScore >= 40) return 'Moderate concern';
    if (normalizedScore >= 20) return 'Notable concern';
    return 'Significant concern';
  }

  private shouldEndConversation(context: SkincareConversationContext): boolean {
    // End after sufficient information gathered (minimum 8 exchanges or user signals readiness)
    const exchangeCount = context.conversationHistory.length;
    const lastMessage = context.conversationHistory[context.conversationHistory.length - 1];

    if (exchangeCount >= 10) return true;

    // Check if user wants to see results
    if (lastMessage?.role === 'user') {
      const lowerMsg = lastMessage.content.toLowerCase();
      if (
        lowerMsg.includes('yes') ||
        lowerMsg.includes('ready') ||
        lowerMsg.includes('show') ||
        lowerMsg.includes('reveal') ||
        lowerMsg.includes('results')
      ) {
        return exchangeCount >= 6;
      }
    }

    return false;
  }
}

export const skincareAIService = new SkincareAIService();
export default skincareAIService;
