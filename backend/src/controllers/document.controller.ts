import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import documentService from '../services/document.service';
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
}

export default new DocumentController();
