import { Router } from 'express';
import {
  getAllBlogs,
  getAllBlogsAdmin,
  getBlogById,
  createBlogDraft,
  createBlog,
  updateBlog,
  deleteBlog,
  uploadBlogImage,
  deleteBlogImage,
} from '../controllers/blogController';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadMiddleware } from '../middleware/uploadMiddleware';

const router = Router();

// Public routes
router.get('/', getAllBlogs);
// Dashboard/admin routes (authentication required)
router.get('/admin', authenticateToken, getAllBlogsAdmin);
router.get('/:id', getBlogById);

// Protected routes
router.post('/draft', authenticateToken, createBlogDraft);
router.post('/', authenticateToken, createBlog);
router.put('/:id', authenticateToken, updateBlog);
router.delete('/:id', authenticateToken, deleteBlog);
router.post('/:id/image', authenticateToken, uploadMiddleware.single('file'), uploadBlogImage);
router.delete('/:id/image', authenticateToken, deleteBlogImage);

export default router;