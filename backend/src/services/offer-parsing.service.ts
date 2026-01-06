import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Offer Parsing Service
 * Extracts structured discount/offer data from uploaded documents using AI
 */
export class OfferParsingService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Parse discount document and extract structured offers
   */
  async parseDiscountDocument(documentId: string, storeId: string): Promise<any[]> {
    try {
      // Get document details
      const docResult = await pool.query(
        'SELECT original_name, file_path, file_type FROM documents WHERE id = $1 AND store_id = $2',
        [documentId, storeId]
      );

      if (docResult.rows.length === 0) {
        throw new Error('Document not found');
      }

      const doc = docResult.rows[0];

      // Extract text content from document
      const content = await this.extractTextContent(doc.file_path, doc.file_type);

      if (!content || content.trim().length === 0) {
        throw new Error('Could not extract text from document');
      }

      // Parse offers using AI
      const offers = await this.parseOffersWithAI(content);

      // Save offers to database
      const savedOffers = [];
      for (const offer of offers) {
        const result = await this.saveOffer(storeId, documentId, offer);
        savedOffers.push(result);
      }

      return savedOffers;
    } catch (error: any) {
      console.error('Error parsing discount document:', error);
      throw error;
    }
  }

  /**
   * Use Claude AI to extract structured offer data from text
   */
  private async parseOffersWithAI(content: string): Promise<any[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Extract all discount codes, promotional offers, bundle deals, and free shipping policies from this document.

For each offer, provide:
- title: Brief descriptive title (required)
- description: Full details (required)
- offer_type: One of: discount_code, promotion, bundle, free_shipping (required)
- code: Discount code if applicable (optional)
- discount_type: percentage, fixed_amount, or free_shipping (optional)
- discount_value: Numeric value - 25 for 25%, 500 for ₹500 off (optional)
- minimum_purchase: Minimum order amount if applicable (optional)
- start_date: Start date in ISO format YYYY-MM-DD if mentioned (optional)
- end_date: End date in ISO format YYYY-MM-DD if mentioned (optional)
- terms_and_conditions: Any restrictions or conditions (optional)

Return ONLY a valid JSON array with no additional text. Example format:
[
  {
    "title": "Winter Sale 25% Off",
    "description": "Get 25% off on all winter products",
    "offer_type": "discount_code",
    "code": "WINTER25",
    "discount_type": "percentage",
    "discount_value": 25,
    "minimum_purchase": 1000,
    "start_date": "2026-01-01",
    "end_date": "2026-01-31",
    "terms_and_conditions": "Valid on winter collection only"
  }
]

Document content:
${content.substring(0, 10000)}`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const offers = JSON.parse(jsonMatch[0]);
        return Array.isArray(offers) ? offers : [];
      }

      console.warn('No valid JSON found in AI response');
      return [];
    } catch (error: any) {
      console.error('Error parsing offers with AI:', error);
      throw new Error(`Failed to parse offers: ${error.message}`);
    }
  }

  /**
   * Save offer to database
   */
  private async saveOffer(storeId: string, documentId: string, offer: any): Promise<any> {
    try {
      const result = await pool.query(
        `INSERT INTO store_offers
         (store_id, title, description, offer_type, code, discount_type, discount_value,
          minimum_purchase, start_date, end_date, is_active, source, document_id,
          terms_and_conditions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, 'document_upload', $11, $12)
         RETURNING *`,
        [
          storeId,
          offer.title || 'Untitled Offer',
          offer.description || '',
          offer.offer_type || 'promotion',
          offer.code || null,
          offer.discount_type || null,
          offer.discount_value || null,
          offer.minimum_purchase || null,
          offer.start_date || null,
          offer.end_date || null,
          documentId,
          offer.terms_and_conditions || null,
        ]
      );

      return result.rows[0];
    } catch (error: any) {
      console.error('Error saving offer:', error);
      throw error;
    }
  }

  /**
   * Extract text content from various file formats
   */
  private async extractTextContent(filePath: string, fileType: string): Promise<string> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Plain text and CSV files
      if (fileType === 'text/plain' || fileType === 'text/csv') {
        return fs.readFileSync(filePath, 'utf-8');
      }

      // PDF files
      if (fileType === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
      }

      // Unsupported format
      throw new Error(`Unsupported file type: ${fileType}`);
    } catch (error: any) {
      console.error('Error extracting text content:', error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }
}

export default new OfferParsingService();
