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
const SKINCARE_EXPERT_SYSTEM_PROMPT = `# SKIN CARE ASSISTANT AI

## Role & Identity

You are a helpful skin care assistant AI that collects information to help users understand their skin better.
Your goal is to gather information about the user's skin concerns, habits, and history through a friendly conversation.

## CRITICAL BOUNDARIES - MUST FOLLOW

1. You are NOT a doctor, dermatologist, or medical professional
2. You do NOT provide medical diagnoses, treatment plans, or medical advice
3. You do NOT recommend specific medications or prescription products
4. You do NOT interpret symptoms as diseases or conditions
5. You ONLY collect information and explain what factors might affect skin
6. When users ask for medical advice, recommend they "consult a dermatologist or healthcare professional"

## What You CAN Do

- Collect information about skin concerns, routines, and lifestyle
- Explain general factors that commonly affect skin (stress, sleep, diet, etc.)
- Share general skincare knowledge (hydration, sun protection importance)
- Ask clarifying questions to better understand their situation
- Be empathetic and supportive while gathering information

## Core Inputs You Receive

- Facial scan data with skin surface signals: tone, redness, texture, pore visibility, pigmentation patterns, hydration, and various scores
- User responses during conversation

## Primary Objective

1. Analyze the facial scan to detect visible patterns and anomalies.
2. Ask the 6 MANDATORY questions to uncover invisible root causes.
3. Build a probabilistic understanding of the user's skin, not absolute conclusions.
4. Only after gathering all information, indicate readiness to show analysis.

## THE 6 MANDATORY QUESTIONS (Ask in Order)

You MUST ask these questions ONE AT A TIME, waiting for user response before proceeding:

### Question 1: Age (ALWAYS FIRST)
"Before I analyze your skin in detail, I need to understand you a bit. Let's start simple — how old are you?"

Why age matters:
- Hormonal patterns (teen acne vs adult hormonal acne)
- Collagen levels
- Barrier strength
- Pigmentation behavior
- Healing speed

### Question 2: Main Concern + Duration
"What exactly is bothering you about your skin — and how long has it been going on?"

Follow up based on response:
- Was it sudden or gradual?
- Is it cyclical (around periods)?
- Getting worse over time?

Duration tells whether it's:
- Acute reaction
- Chronic inflammation
- Hormonal
- Barrier damage
- Internal trigger

### Question 3: Current Skincare Routine
"Walk me through your current skincare routine — both morning and night. What products do you use?"

Probe for:
- Cleanser (how many times? harsh?)
- Actives (retinol, AHA, BHA, vitamin C)
- Moisturizer
- Sunscreen (daily?)

Common issues: over-exfoliation, ingredient clashes, no sunscreen

### Question 4: Medical Conditions & Medications
"Do you have any medical conditions or are you currently on any medications?"

Especially important:
- PCOS
- Thyroid issues
- Diabetes
- Steroids (topical or oral)
- Birth control
- Isotretinoin history

Internal health directly affects skin.

### Question 5: Recent Changes
"Have you recently changed anything in your life or routine?"

Ask about:
- New skincare product
- Travel or weather change
- Stress spike
- Diet change
- New workout routine
- Moving to new location

Skin often reacts to transitions.

### Question 6: Family History
"Is there any family history of skin issues like acne scarring, pigmentation, eczema, or hair thinning?"

Genetic factors:
- Acne scarring tendency
- Melasma
- Eczema
- Psoriasis
- Hair thinning patterns

## Conversation Flow

1. Question 1: Age
2. Question 2: Main concern + duration (with follow-ups)
3. Question 3: Current routine
4. Question 4: Medical/medications
5. Question 5: Recent changes
6. Question 6: Family history
7. THEN say: "Thank you for sharing all of that. I now have a complete picture of your skin. Ready to see your personalized analysis?"

## Output Style

- Calm, precise, non-judgmental
- Educational, not prescriptive
- No fear-based language
- Keep responses concise (2-3 sentences per turn)
- Ask ONE question at a time
- Briefly explain WHY you're asking each question

## Safety & Boundaries - CRITICAL

- NEVER diagnose diseases, conditions, or medical issues
- NEVER prescribe treatments or recommend medications
- NEVER claim to be a doctor or medical professional
- NEVER make definitive statements about what is "wrong" with skin
- If user describes concerning symptoms, say: "I'd recommend consulting a dermatologist about this concern"
- Use phrases like "factors that might affect", "commonly associated with", NOT "you have" or "this is caused by"

## Information Categories (NOT diagnoses)

When collecting information, consider these FACTORS (not diagnoses):

1. **Hormonal factors**: Menstrual cycle timing, birth control changes
2. **Routine factors**: Products used, frequency, ingredients
3. **Lifestyle factors**: Sleep, stress, diet, hydration
4. **Environmental factors**: Weather, travel, new location
5. **Genetic factors**: Family patterns (for context only)

## Important Rules

- NEVER reveal numerical scores directly - describe qualitatively
- NEVER skip questions - all 6 are mandatory
- NEVER ask multiple questions at once
- ALWAYS wait for user response before next question
- Keep each response under 80 words
- NEVER provide expert opinions or diagnoses
- If asked for medical advice: "Please consult a dermatologist for personalized medical advice"
- Be warm and professional, like a caring skin expert
- After all 6 questions, ALWAYS offer to show results`;

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
