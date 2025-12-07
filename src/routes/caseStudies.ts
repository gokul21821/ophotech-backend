import { Router } from 'express';
import {
  getAllCaseStudies,
  getCaseStudyById,
  createCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
} from '../controllers/caseStudyController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', getAllCaseStudies);
router.get('/:id', getCaseStudyById);

// Protected routes
router.post('/', authenticateToken, createCaseStudy);
router.put('/:id', authenticateToken, updateCaseStudy);
router.delete('/:id', authenticateToken, deleteCaseStudy);

export default router;