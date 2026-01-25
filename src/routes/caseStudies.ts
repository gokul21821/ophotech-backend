import { Router } from 'express';
import {
  getAllCaseStudies,
  getCaseStudyById,
  createCaseStudyDraft,
  createCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
  uploadCaseStudyImage,
  deleteCaseStudyImage,
} from '../controllers/caseStudyController';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadMiddleware } from '../middleware/uploadMiddleware';

const router = Router();

// Public routes
router.get('/', getAllCaseStudies);
router.get('/:id', getCaseStudyById);

// Protected routes
router.post('/draft', authenticateToken, createCaseStudyDraft);
router.post('/', authenticateToken, createCaseStudy);
router.put('/:id', authenticateToken, updateCaseStudy);
router.delete('/:id', authenticateToken, deleteCaseStudy);
router.post('/:id/image', authenticateToken, uploadMiddleware.single('file'), uploadCaseStudyImage);
router.delete('/:id/image', authenticateToken, deleteCaseStudyImage);

export default router;