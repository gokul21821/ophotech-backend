import { Router } from 'express';
import {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
} from '../controllers/blogController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', getAllBlogs);
router.get('/:id', getBlogById);

// Protected routes
router.post('/', authenticateToken, createBlog);
router.put('/:id', authenticateToken, updateBlog);
router.delete('/:id', authenticateToken, deleteBlog);

export default router;