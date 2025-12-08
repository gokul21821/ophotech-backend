import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../db';
import sanitizeHtml from 'sanitize-html';
import { deleteFile, getPublicUrl, uploadFile } from '../services/supabaseClient';
import { generateFilePath, validateImageFile } from '../middleware/uploadMiddleware';

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

    const dataWithUrls = blogs.map((b) => ({
      ...b,
      imageUrl: b.imagePath ? getPublicUrl(b.imagePath) : null,
    }));

    res.status(200).json({
      success: true,
      count: dataWithUrls.length,
      data: dataWithUrls,
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
      data: {
        ...blog,
        imageUrl: blog.imagePath ? getPublicUrl(blog.imagePath) : null,
      },
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

    const parsedDate = date ? new Date(date) : new Date();
    const finalDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    // Create blog
    const blog = await prisma.blog.create({
      data: {
        title: title.trim(),
        description: sanitizedDescription,
        date: finalDate,
        authorId: req.user.userId,
        imagePath: null,
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
      data: {
        ...blog,
        imageUrl: blog.imagePath ? getPublicUrl(blog.imagePath) : null,
      },
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
    const parsedDate = date ? new Date(date) : undefined;
    const finalDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined;

    const updatedBlog = await prisma.blog.update({
      where: { id },
      data: {
        title: title.trim(),
        description: sanitizedDescription,
        date: finalDate,
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
      data: {
        ...updatedBlog,
        imageUrl: updatedBlog.imagePath ? getPublicUrl(updatedBlog.imagePath) : null,
      },
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
    if (blog.imagePath) {
      try {
        await deleteFile(blog.imagePath);
      } catch (storageErr) {
        console.error('Delete blog image error:', storageErr);
      }
    }

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

// Upload/replace blog image
export async function uploadBlogImage(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const file = req.file;
    validateImageFile(file);

    const blog = await prisma.blog.findUnique({ where: { id } });
    if (!blog) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }

    if (blog.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only edit your own blogs' });
      return;
    }

    if (blog.imagePath) {
      try {
        await deleteFile(blog.imagePath);
      } catch (err) {
        console.error('Failed to delete old image:', err);
      }
    }

    const filePath = generateFilePath('blog', id, file!.originalname);
    await uploadFile(filePath, file!.buffer, file!.mimetype);

    const updated = await prisma.blog.update({
      where: { id },
      data: { imagePath: filePath },
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
      message: 'Image uploaded successfully',
      data: {
        ...updated,
        imageUrl: getPublicUrl(filePath),
      },
    });
  } catch (error: any) {
    console.error('Upload blog image error:', error);
    res.status(400).json({ error: error.message || 'Failed to upload image' });
  }
}

// Delete blog image
export async function deleteBlogImage(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const blog = await prisma.blog.findUnique({ where: { id } });

    if (!blog) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }

    if (blog.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own blogs' });
      return;
    }

    if (!blog.imagePath) {
      res.status(400).json({ error: 'No image to delete' });
      return;
    }

    try {
      await deleteFile(blog.imagePath);
    } catch (err) {
      console.error('Failed to delete image from storage:', err);
    }

    const updated = await prisma.blog.update({
      where: { id },
      data: { imagePath: null },
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
      message: 'Image deleted successfully',
      data: {
        ...updated,
        imageUrl: null,
      },
    });
  } catch (error) {
    console.error('Delete blog image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
}