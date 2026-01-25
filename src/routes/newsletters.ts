import { Router } from 'express';
import {
  getAllNewsletters,
  getNewsletterById,
  createNewsletterDraft,
  createNewsletter,
  updateNewsletter,
  deleteNewsletter,
  uploadNewsletterImage,
  deleteNewsletterImage,
} from '../controllers/newsletterController';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadMiddleware } from '../middleware/uploadMiddleware';

const router = Router();

// Public routes (no authentication needed)
router.get('/', getAllNewsletters);
router.get('/:id', getNewsletterById);

// Protected routes (authentication required)
router.post('/draft', authenticateToken, createNewsletterDraft);
router.post('/', authenticateToken, createNewsletter);
router.put('/:id', authenticateToken, updateNewsletter);
router.delete('/:id', authenticateToken, deleteNewsletter);
router.post('/:id/image', authenticateToken, uploadMiddleware.single('file'), uploadNewsletterImage);
router.delete('/:id/image', authenticateToken, deleteNewsletterImage);

export default router;