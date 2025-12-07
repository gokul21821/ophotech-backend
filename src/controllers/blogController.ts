import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../db';
import sanitizeHtml from 'sanitize-html';

// HTML sanitization config
const sanitizeConfig = {
  allowedTags: ['p', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'br'],
  allowedAttributes: {
    'a': ['href', 'target', 'rel']
  }
};

// Get all blogs (public)
export async function getAllBlogs(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const blogs = await prisma.blog.findMany({
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      count: blogs.length,
      data: blogs,
    });
  } catch (error) {
    console.error('Get blogs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get single blog by ID
export async function getBlogById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const blog = await prisma.blog.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!blog) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create new blog (protected)
export async function createBlog(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { title, description, date } = req.body;

    // Validation
    if (!title || !description) {
      res.status(400).json({ error: 'Title and description are required' });
      return;
    }

    const sanitizedDescription = sanitizeHtml(description, sanitizeConfig);
    const plainText = sanitizedDescription.replace(/<[^>]*>/g, '').trim();

    if (title.trim().length === 0 || plainText.length === 0) {
      res.status(400).json({ error: 'Title and description cannot be empty' });
      return;
    }

    // Create blog
    const blog = await prisma.blog.create({
      data: {
        title: title.trim(),
        description: sanitizedDescription,
        date: new Date(date) || new Date(),
        authorId: req.user.userId,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      data: blog,
    });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update blog (protected - only author or admin)
export async function updateBlog(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { title, description, date } = req.body;

    // Validation
    if (!title || !description) {
      res.status(400).json({ error: 'Title and description are required' });
      return;
    }

    const sanitizedDescription = sanitizeHtml(description, sanitizeConfig);
    const plainText = sanitizedDescription.replace(/<[^>]*>/g, '').trim();

    if (title.trim().length === 0 || plainText.length === 0) {
      res.status(400).json({ error: 'Title and description cannot be empty' });
      return;
    }

    // Find blog
    const blog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!blog) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }

    // Check authorization (only author or admin can edit)
    if (blog.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only edit your own blogs' });
      return;
    }

    // Update blog
    const updatedBlog = await prisma.blog.update({
      where: { id },
      data: {
        title: title.trim(),
        description: sanitizedDescription,
        date: date ? new Date(date) : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Blog updated successfully',
      data: updatedBlog,
    });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete blog (protected - only author or admin)
export async function deleteBlog(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Find blog
    const blog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!blog) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }

    // Check authorization (only author or admin can delete)
    if (blog.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own blogs' });
      return;
    }

    // Delete blog
    await prisma.blog.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Blog deleted successfully',
    });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}