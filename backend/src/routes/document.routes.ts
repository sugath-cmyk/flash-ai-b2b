import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import documentController, { uploadValidation } from '../controllers/document.controller';
import { upload } from '../config/multer';

const router = Router();

// All document routes require authentication
router.use(authenticate);

// POST /api/documents/upload - Upload a document
router.post('/upload', upload.single('file'), uploadValidation, documentController.uploadDocument.bind(documentController));

// POST /api/documents/:id/analyze - Analyze a document
router.post('/:id/analyze', documentController.analyzeDocument.bind(documentController));

// GET /api/documents - Get user's documents
router.get('/', documentController.getDocuments.bind(documentController));

// GET /api/documents/:id - Get specific document
router.get('/:id', documentController.getDocument.bind(documentController));

// GET /api/documents/:id/download - Download document
router.get('/:id/download', documentController.downloadDocument.bind(documentController));

// DELETE /api/documents/:id - Delete document
router.delete('/:id', documentController.deleteDocument.bind(documentController));

export default router;
