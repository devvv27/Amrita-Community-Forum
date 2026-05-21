import express from 'express';
import { chatWithAI } from '../controllers/ai.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Simple chat endpoint — requires authentication
router.post('/chat', requireAuth, chatWithAI);

export default router;
