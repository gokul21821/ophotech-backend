import { Router } from 'express';
import {
  getAllNewsletters,
  getNewsletterById,
  createNewsletter,
  updateNewsletter,
  deleteNewsletter,
} from '../controllers/newsletterController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Public routes (no authentication needed)
router.get('/', getAllNewsletters);
router.get('/:id', getNewsletterById);

// Protected routes (authentication required)
router.post('/', authenticateToken, createNewsletter);
router.put('/:id', authenticateToken, updateNewsletter);
router.delete('/:id', authenticateToken, deleteNewsletter);

export default router;