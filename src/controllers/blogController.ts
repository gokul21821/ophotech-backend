import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../db';
import { Prisma } from '@prisma/client';
import { deleteFile, getPublicUrl, uploadFile } from '../services/supabaseClient';
import { generateFilePath, validateImageFile } from '../middleware/uploadMiddleware';
import { extractPlainTextFromTiptap, findFirstImageAttrs } from '../utils/tiptap';
import { deleteAllContentImages, syncStorageWithContent } from '../utils/syncImages';

// Create a draft blog (protected)
export async function createBlogDraft(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const blog = await prisma.blog.create({
      data: {
        title: '',
        content: { type: 'doc', content: [] }, // Empty TipTap doc for draft
        date: new Date(),
        authorId: req.user.userId,
      },
      include: {
        author: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Draft created successfully',
      data: {
        ...blog,
        imageUrl: null,
      },
    });
  } catch (error) {
    console.error('Create blog draft error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

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

    // Filter out drafts (empty content array means draft)
    const publishedBlogs = blogs.filter((b) => {
      const content = b.content as any;
      return content?.content && Array.isArray(content.content) && content.content.length > 0;
    });

    const dataWithUrls = publishedBlogs.map((b) => ({
      ...b,
      imageUrl: findFirstImageAttrs(b.content)?.src ?? null,
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
        imageUrl: findFirstImageAttrs(blog.content)?.src ?? null,
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

    const { title, date, content } = req.body as {
      title?: string;
      date?: string;
      content?: unknown;
    };

    // Validation
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    if (title.trim().length === 0) {
      res.status(400).json({ error: 'Title cannot be empty' });
      return;
    }

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const plainText = extractPlainTextFromTiptap(content).trim();
    if (plainText.length === 0) {
      res.status(400).json({ error: 'Content cannot be empty' });
      return;
    }

    const parsedDate = date ? new Date(date) : new Date();
    const finalDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    // Create blog
    const blog = await prisma.blog.create({
      data: {
        title: title.trim(),
        content: content as Prisma.InputJsonValue,
        date: finalDate,
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

    // Sync images
    try {
      await syncStorageWithContent('blog', blog.id, content);
    } catch (syncErr) {
      console.error('Blog image sync error:', syncErr);
    }

    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      data: {
        ...blog,
        imageUrl: findFirstImageAttrs(blog.content)?.src ?? null,
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
    const { title, date, content } = req.body as {
      title?: string;
      date?: string;
      content?: unknown;
    };

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

    // Validation
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    if (title.trim().length === 0) {
      res.status(400).json({ error: 'Title cannot be empty' });
      return;
    }

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const plainText = extractPlainTextFromTiptap(content).trim();
    if (plainText.length === 0) {
      res.status(400).json({ error: 'Content cannot be empty' });
      return;
    }

    // Update blog
    const parsedDate = date ? new Date(date) : undefined;
    const finalDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined;

    const updatedBlog = await prisma.blog.update({
      where: { id },
      data: {
        title: title.trim(),
        content: content as Prisma.InputJsonValue,
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

    // Sync images
    try {
      await syncStorageWithContent('blog', id, content);
    } catch (syncErr) {
      console.error('Blog image sync error:', syncErr);
    }

    res.status(200).json({
      success: true,
      message: 'Blog updated successfully',
      data: {
        ...updatedBlog,
        imageUrl: findFirstImageAttrs(updatedBlog.content)?.src ?? null,
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

    // Delete all images under blogs/<id>/ (inline images)
    try {
      await deleteAllContentImages('blog', id);
    } catch (storageErr) {
      console.error('Delete blog folder images error:', storageErr);
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

    const filePath = generateFilePath('blog', id, file!.originalname);
    await uploadFile(filePath, file!.buffer, file!.mimetype);
    const url = getPublicUrl(filePath);
    if (!url) {
      res.status(500).json({ error: 'Failed to generate image URL' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url,
        filePath,
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
    const { filePath } = (req.body ?? {}) as { filePath?: string };
    const blog = await prisma.blog.findUnique({ where: { id } });

    if (!blog) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }

    if (blog.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own blogs' });
      return;
    }

    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({
        error:
          'filePath is required. Inline images are controlled by the editor; orphaned images are purged on save.',
      });
      return;
    }

    if (!filePath.startsWith(`blogs/${id}/`)) {
      res.status(400).json({ error: 'Invalid filePath for this blog' });
      return;
    }

    await deleteFile(filePath);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: { filePath },
    });
  } catch (error) {
    console.error('Delete blog image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
}