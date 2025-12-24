import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import aiService from './ai.service';
import fs from 'fs/promises';
import path from 'path';

interface UploadedFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
}

interface DocumentAnalysis {
  summary: string;
  keyPoints: string[];
  sentiment?: string;
  entities?: string[];
}

export class DocumentService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  async uploadDocument(
    file: UploadedFile,
    userId: string,
    teamId?: string,
    options?: { analyze?: boolean }
  ): Promise<any> {
    // Save document metadata to database
    const result = await pool.query(
      `INSERT INTO documents (user_id, team_id, filename, original_name, mime_type, size, file_path, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, filename, original_name, mime_type, size, status, created_at`,
      [
        userId,
        teamId || null,
        file.filename,
        file.originalName,
        file.mimeType,
        file.size,
        file.path,
        'uploaded',
      ]
    );

    const document = result.rows[0];

    // Analyze document if requested
    if (options?.analyze) {
      await this.analyzeDocument(document.id, userId);
    }

    return document;
  }

  async analyzeDocument(documentId: string, userId: string): Promise<DocumentAnalysis> {
    // Get document from database
    const docResult = await pool.query(
      `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (docResult.rows.length === 0) {
      throw createError('Document not found', 404);
    }

    const document = docResult.rows[0];

    // Update status to analyzing
    await pool.query(
      `UPDATE documents SET status = 'analyzing' WHERE id = $1`,
      [documentId]
    );

    try {
      // Read file content
      const content = await this.extractTextFromFile(document.file_path, document.mime_type);

      // Use AI to analyze the document
      const prompt = `Analyze the following document and provide:
1. A concise summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Sentiment (positive/negative/neutral)
4. Important entities mentioned (people, organizations, dates, etc.)

Document content:
${content.substring(0, 10000)}`;

      const analysisResult = await aiService.chat({
        message: prompt,
        userId,
        model: 'claude-3-sonnet',
      });

      // Parse the AI response to extract structured data
      const analysis = this.parseAnalysisResponse(analysisResult.content);

      // Save analysis to database
      await pool.query(
        `UPDATE documents
         SET status = 'analyzed',
             analysis_result = $1,
             analyzed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(analysis), documentId]
      );

      return analysis;
    } catch (error: any) {
      // Update status to failed
      await pool.query(
        `UPDATE documents
         SET status = 'failed',
             error_message = $1
         WHERE id = $2`,
        [error.message, documentId]
      );
      throw error;
    }
  }

  private async extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
    // For now, only handle text files
    // In production, you'd want to use libraries like pdf-parse, mammoth, etc.
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    }

    // For PDF, DOC, etc., you'd integrate appropriate libraries
    // For now, return a placeholder
    return `[File type ${mimeType} - Content extraction not yet implemented. Please use text files for now.]`;
  }

  private parseAnalysisResponse(response: string): DocumentAnalysis {
    // Simple parsing logic - in production you might want to use more sophisticated parsing
    const lines = response.split('\n');

    let summary = '';
    const keyPoints: string[] = [];
    let sentiment = '';
    const entities: string[] = [];

    let currentSection = '';

    for (const line of lines) {
      const lower = line.toLowerCase();

      if (lower.includes('summary:') || lower.includes('summary')) {
        currentSection = 'summary';
        continue;
      } else if (lower.includes('key points:') || lower.includes('key points')) {
        currentSection = 'keyPoints';
        continue;
      } else if (lower.includes('sentiment:') || lower.includes('sentiment')) {
        currentSection = 'sentiment';
        continue;
      } else if (lower.includes('entities:') || lower.includes('entities')) {
        currentSection = 'entities';
        continue;
      }

      if (currentSection === 'summary' && line.trim()) {
        summary += line.trim() + ' ';
      } else if (currentSection === 'keyPoints' && line.trim().match(/^[-•*]\s/)) {
        keyPoints.push(line.trim().replace(/^[-•*]\s/, ''));
      } else if (currentSection === 'sentiment' && line.trim()) {
        sentiment = line.trim();
      } else if (currentSection === 'entities' && line.trim()) {
        entities.push(line.trim().replace(/^[-•*]\s/, ''));
      }
    }

    return {
      summary: summary.trim() || 'No summary available',
      keyPoints: keyPoints.length > 0 ? keyPoints : ['No key points extracted'],
      sentiment: sentiment || 'neutral',
      entities: entities.length > 0 ? entities : [],
    };
  }

  async getDocuments(userId: string, teamId?: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT id, filename, original_name, mime_type, size, status,
              analysis_result, analyzed_at, created_at, updated_at
       FROM documents
       WHERE user_id = $1 AND ($2::uuid IS NULL OR team_id = $2)
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId, teamId || null]
    );
    return result.rows;
  }

  async getDocument(documentId: string, userId: string): Promise<any> {
    const result = await pool.query(
      `SELECT id, filename, original_name, mime_type, size, status,
              analysis_result, analyzed_at, error_message, created_at, updated_at
       FROM documents
       WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('Document not found', 404);
    }

    return result.rows[0];
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    // Get document to delete file
    const docResult = await pool.query(
      `SELECT file_path FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (docResult.rows.length === 0) {
      throw createError('Document not found', 404);
    }

    const filePath = docResult.rows[0].file_path;

    // Delete from database
    await pool.query(
      `DELETE FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    // Delete file from filesystem
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file:', error);
      // Don't throw error if file deletion fails
    }
  }

  async downloadDocument(documentId: string, userId: string): Promise<{ path: string; filename: string }> {
    const result = await pool.query(
      `SELECT file_path, original_name FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('Document not found', 404);
    }

    return {
      path: result.rows[0].file_path,
      filename: result.rows[0].original_name,
    };
  }
}

export default new DocumentService();
