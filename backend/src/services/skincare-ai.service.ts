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

## USING ML ANALYSIS DATA - IMPORTANT

You will receive the ML scan analysis as "Current Face Scan Data". USE THIS INTELLIGENTLY:

### Validating User Concerns
- When user mentions a concern, CHECK if the ML data supports it
- If ML shows "Moderate concern" or worse for acne, and user mentions acne → VALIDATE: "I can see from your scan that there are some visible signs of that"
- If user mentions a concern but ML shows "Good" or "Excellent" → DON'T contradict, but note: "Your scan looks relatively good in that area, but let's explore what you're experiencing"

### Probing Unmentioned Issues
- If ML shows "Notable concern" or "Significant concern" for something user DIDN'T mention, GENTLY ask:
  - "I noticed your scan shows some [hydration/texture/etc] patterns - is that something you've been aware of?"
  - "Your scan picked up some [issue] - would you like to include that in your assessment?"

### Correlation Examples
- ML shows high acne score + user says "acne for years" → ACKNOWLEDGE: "Yes, I can see signs of that in your scan"
- ML shows low hydration + user mentions "dry skin" → VALIDATE: "That matches what I see - hydration appears to be an area to focus on"
- ML shows high pigmentation + user only mentions "acne" → PROBE: "I also notice some uneven tone in your scan - is pigmentation a concern too?"

### Key Phrases to Use
- "Your scan suggests..." (not "you have")
- "I notice some patterns that might indicate..."
- "This aligns with what I see in your analysis"
- "Your scan shows relatively good results in that area"

## Primary Objective

1. Use the facial scan data to VALIDATE and CORRELATE with user responses
2. Ask the 6 MANDATORY questions while referencing scan findings where relevant
3. Gently probe if ML detected issues the user didn't mention
4. Build a complete picture combining ML data + user input
5. Only after gathering all information, indicate readiness to show analysis

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

### Question 4: ADAPTIVE - Based on ML Findings (Medical/Lifestyle)
IMPORTANT: Tailor this question based on what the scan detected:

IF scan shows ACNE concerns:
"Since I see some acne patterns in your scan, I'd like to understand potential triggers. Is your acne hormonal (cycle-related), stress-related, or do you notice diet triggers?"

IF scan shows PIGMENTATION concerns:
"Your scan shows some uneven tone. Sun exposure often plays a role. Do you use sunscreen daily? Any history of sunburns or tanning?"

IF scan shows HYDRATION/DRYNESS concerns:
"Your scan suggests hydration needs attention. How much water do you drink daily? Do you moisturize consistently?"

IF scan shows REDNESS concerns:
"I notice some redness patterns. Does your skin react easily to products? Any history of sensitivity, rosacea, or eczema?"

IF scan shows AGING/WRINKLE concerns:
"Your scan shows some fine line patterns. How's your sleep been? Do you use sun protection regularly?"

### Question 5: Recent Changes - CONTEXTUAL
Tailor based on user's concerns AND scan findings:

For ACNE: "Have you changed products, started/stopped birth control, or been under more stress?"
For DRYNESS: "Has the weather changed? Started a new cleanser? AC or heating exposure?"
For PIGMENTATION: "More sun exposure lately? Any hormonal changes?"
For REDNESS: "New products? Increased stress? Dietary changes?"

### Question 6: Family History - RELEVANT ONLY
Only ask about family history relevant to detected concerns:

For ACNE: "Does acne or scarring run in your family?"
For PIGMENTATION: "Any family history of melasma or hyperpigmentation?"
For REDNESS: "Family history of rosacea, eczema, or sensitive skin?"
For AGING: "How did your parents' skin age?"

Skip asking about conditions the scan shows NO concern for.

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
    const concerns: string[] = [];
    const strengths: string[] = [];

    if (analysis.skinTone) {
      lines.push(`Skin Tone: ${analysis.skinTone}`);
    }
    if (analysis.skinUndertone) {
      lines.push(`Undertone: ${analysis.skinUndertone}`);
    }

    // Track scores and categorize as concerns or strengths
    const metrics: { name: string; score: number | undefined; inverse: boolean }[] = [
      { name: 'Overall Skin Health', score: analysis.skinScore, inverse: false },
      { name: 'Acne', score: analysis.acneScore, inverse: true },
      { name: 'Fine Lines/Wrinkles', score: analysis.wrinkleScore, inverse: true },
      { name: 'Pigmentation/Uneven Tone', score: analysis.pigmentationScore, inverse: true },
      { name: 'Hydration', score: analysis.hydrationScore, inverse: false },
      { name: 'Skin Texture', score: analysis.textureScore, inverse: false },
      { name: 'Redness/Inflammation', score: analysis.rednessScore, inverse: true },
      { name: 'Dark Circles', score: analysis.darkCirclesScore, inverse: true },
      { name: 'Pore Visibility', score: analysis.poreScore, inverse: true },
    ];

    for (const metric of metrics) {
      if (metric.score === undefined) continue;

      const description = this.scoreToDescription(metric.score, metric.inverse);
      lines.push(`${metric.name}: ${description} (raw: ${metric.score})`);

      // Categorize based on normalized score
      const normalizedScore = metric.inverse ? 100 - metric.score : metric.score;
      if (normalizedScore < 40) {
        concerns.push(`${metric.name} (${description})`);
      } else if (normalizedScore >= 70) {
        strengths.push(metric.name);
      }
    }

    // Add summary sections for AI to reference easily
    let summary = lines.join('\n');

    if (concerns.length > 0) {
      summary += `\n\n### ML-DETECTED CONCERNS (mention these if user doesn't):\n- ${concerns.join('\n- ')}`;
    }

    if (strengths.length > 0) {
      summary += `\n\n### AREAS LOOKING GOOD:\n- ${strengths.join('\n- ')}`;
    }

    return summary;
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
