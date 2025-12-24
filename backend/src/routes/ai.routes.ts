import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import aiController, { chatValidation } from '../controllers/ai.controller';
import { body } from 'express-validator';

const router = Router();

// All AI routes require authentication
router.use(authenticate);

// POST /api/ai/chat - Send message to AI assistant
router.post('/chat', chatValidation, aiController.chat.bind(aiController));

// GET /api/ai/conversations - Get user's chat conversations
router.get('/conversations', aiController.getConversations.bind(aiController));

// GET /api/ai/conversations/:id - Get specific conversation
router.get('/conversations/:id', aiController.getConversation.bind(aiController));

// PATCH /api/ai/conversations/:id - Update conversation title
router.patch(
  '/conversations/:id',
  [body('title').trim().notEmpty().withMessage('Title is required')],
  aiController.updateConversationTitle.bind(aiController)
);

// DELETE /api/ai/conversations/:id - Delete conversation
router.delete('/conversations/:id', aiController.deleteConversation.bind(aiController));

export default router;
