import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import documentService from '../services/document.service';
import offerParsingService from '../services/offer-parsing.service';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const uploadValidation = [
  body('analyze').optional().isBoolean().withMessage('Analyze must be a boolean'),
];

class DocumentController {
  async uploadDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      if (!req.file) {
        throw createError('No file uploaded', 400);
      }

      const file = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      };

      const analyze = req.body.analyze === 'true' || req.body.analyze === true;

      const document = await documentService.uploadDocument(
        file,
        req.user.id,
        req.user.teamId || undefined,
        { analyze }
      );

      res.json({
        success: true,
        data: { document },
      });
    } catch (error) {
      next(error);
    }
  }

  async analyzeDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id } = req.params;
      const analysis = await documentService.analyzeDocument(id, req.user.id);

      res.json({
        success: true,
        data: { analysis },
      });
    } catch (error) {
      next(error);
    }
  }

  async getDocuments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const documents = await documentService.getDocuments(
        req.user.id,
        req.user.teamId || undefined
      );

      res.json({
        success: true,
        data: { documents },
      });
    } catch (error) {
      next(error);
    }
  }

  async getDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id } = req.params;
      const document = await documentService.getDocument(id, req.user.id);

      res.json({
        success: true,
        data: { document },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id } = req.params;
      await documentService.deleteDocument(id, req.user.id);

      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async downloadDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { id } = req.params;
      const { path, filename } = await documentService.downloadDocument(id, req.user.id);

      res.download(path, filename);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload store-scoped document (discount lists, policies, etc.)
   */
  async uploadStoreDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      if (!req.file) {
        throw createError('No file uploaded', 400);
      }

      const { storeId } = req.params;
      const userId = req.user.id;
      const documentType = req.body.documentType || 'general'; // discount, offer, promotion, policy, faq

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found or access denied', 404);
      }

      // Create document with store association
      const docResult = await pool.query(
        `INSERT INTO documents
         (user_id, store_id, original_name, file_name, file_path, file_type, file_size, document_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          storeId,
          req.file.originalname,
          req.file.filename,
          req.file.path,
          req.file.mimetype,
          req.file.size,
          documentType,
        ]
      );

      const document = docResult.rows[0];

      // Auto-parse if it's a discount/offer document
      if (['discount', 'offer', 'promotion'].includes(documentType)) {
        // Trigger async parsing (don't block response)
        offerParsingService
          .parseDiscountDocument(document.id, storeId)
          .then((offers) => {
            console.log(`Parsed ${offers.length} offers from document ${document.id}`);
          })
          .catch((err) => {
            console.error('Failed to parse discount document:', err);
          });
      }

      res.json({
        success: true,
        data: { document },
        message: documentType === 'discount' ? 'Document uploaded. Parsing offers in background...' : 'Document uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Parse discount document and extract offers
   */
  async parseDiscountDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { storeId, id } = req.params;
      const userId = req.user.id;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found or access denied', 404);
      }

      // Trigger parsing and offer creation
      const offers = await offerParsingService.parseDiscountDocument(id, storeId);

      res.json({
        success: true,
        data: { offersCreated: offers.length, offers },
        message: `Successfully extracted ${offers.length} offers`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all documents for a store
   */
  async getStoreDocuments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { storeId } = req.params;
      const userId = req.user.id;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found or access denied', 404);
      }

      // Get all documents for this store
      const docsResult = await pool.query(
        `SELECT id, original_name, file_name, file_type, file_size, document_type, created_at
         FROM documents
         WHERE store_id = $1
         ORDER BY created_at DESC`,
        [storeId]
      );

      res.json({
        success: true,
        data: { documents: docsResult.rows },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DocumentController();
