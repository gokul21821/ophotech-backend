import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../db';
import { Prisma } from '@prisma/client';
import { deleteFile, getPublicUrl, uploadFile } from '../services/supabaseClient';
import { generateFilePath, validateImageFile } from '../middleware/uploadMiddleware';
import { extractPlainTextFromTiptap, findFirstImageAttrs } from '../utils/tiptap';
import { deleteAllContentImages, syncStorageWithContent } from '../utils/syncImages';

// Create a draft newsletter (protected)
export async function createNewsletterDraft(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const newsletter = await prisma.newsletter.create({
      data: {
        title: '',
        content: { type: 'doc', content: [] }, // Empty TipTap doc for draft
        edition: null,
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
        ...newsletter,
        imageUrl: null,
      },
    });
  } catch (error) {
    console.error('Create newsletter draft error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get all newsletters (public)
export async function getAllNewsletters(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const newsletters = await prisma.newsletter.findMany({
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
        createdAt: 'desc', // Newest first
      },
    });

    // Filter out drafts (empty content array means draft)
    const publishedNewsletters = newsletters.filter((n) => {
      const content = n.content as any;
      return content?.content && Array.isArray(content.content) && content.content.length > 0;
    });

    const dataWithUrls = publishedNewsletters.map((n) => ({
      ...n,
      imageUrl: findFirstImageAttrs(n.content)?.src ?? null,
    }));

    res.status(200).json({
      success: true,
      count: dataWithUrls.length,
      data: dataWithUrls,
    });
  } catch (error) {
    console.error('Get newsletters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get single newsletter by ID
export async function getNewsletterById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const newsletter = await prisma.newsletter.findUnique({
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

    if (!newsletter) {
      res.status(404).json({ error: 'Newsletter not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...newsletter,
        imageUrl: findFirstImageAttrs(newsletter.content)?.src ?? null,
      },
    });
  } catch (error) {
    console.error('Get newsletter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create new newsletter (protected)
export async function createNewsletter(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { title, date, edition, content } = req.body as {
      title?: string;
      date?: string;
      edition?: string;
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

    const editionValue =
      typeof edition === 'string' ? (edition.trim() ? edition.trim() : null) : null;

    // Create newsletter
    const newsletter = await prisma.newsletter.create({
      data: {
        title: title.trim(),
        content: content as Prisma.InputJsonValue,
        edition: editionValue,
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
      await syncStorageWithContent('newsletter', newsletter.id, content);
    } catch (syncErr) {
      console.error('Newsletter image sync error:', syncErr);
    }

    res.status(201).json({
      success: true,
      message: 'Newsletter created successfully',
      data: {
        ...newsletter,
        imageUrl: findFirstImageAttrs(newsletter.content)?.src ?? null,
      },
    });
  } catch (error) {
    console.error('Create newsletter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update newsletter (protected - only author or admin)
export async function updateNewsletter(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { title, date, edition, content } = req.body as {
      title?: string;
      date?: string;
      edition?: string;
      content?: unknown;
    };

    // Find newsletter
    const newsletter = await prisma.newsletter.findUnique({
      where: { id },
    });

    if (!newsletter) {
      res.status(404).json({ error: 'Newsletter not found' });
      return;
    }

    // Check authorization (only author or admin can edit)
    if (newsletter.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only edit your own newsletters' });
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

    // Update newsletter
    const parsedDate = date ? new Date(date) : undefined;
    const finalDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined;

    // If edition is omitted, leave unchanged; if empty string, clear to null.
    const editionValue =
      typeof edition === 'string' ? (edition.trim() ? edition.trim() : null) : undefined;

    const updatedNewsletter = await prisma.newsletter.update({
      where: { id },
      data: {
        title: title.trim(),
        content: content as Prisma.InputJsonValue,
        date: finalDate,
        edition: editionValue,
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
      await syncStorageWithContent('newsletter', id, content);
    } catch (syncErr) {
      console.error('Newsletter image sync error:', syncErr);
    }

    res.status(200).json({
      success: true,
      message: 'Newsletter updated successfully',
      data: {
        ...updatedNewsletter,
        imageUrl: findFirstImageAttrs(updatedNewsletter.content)?.src ?? null,
      },
    });
  } catch (error) {
    console.error('Update newsletter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete newsletter (protected - only author or admin)
export async function deleteNewsletter(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Find newsletter
    const newsletter = await prisma.newsletter.findUnique({
      where: { id },
    });

    if (!newsletter) {
      res.status(404).json({ error: 'Newsletter not found' });
      return;
    }

    // Check authorization (only author or admin can delete)
    if (newsletter.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own newsletters' });
      return;
    }

    // Delete all images under newsletters/<id>/ (inline images)
    try {
      await deleteAllContentImages('newsletter', id);
    } catch (storageErr) {
      console.error('Delete newsletter folder images error:', storageErr);
      // Continue even if storage deletion fails
    }

    await prisma.newsletter.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Newsletter deleted successfully',
    });
  } catch (error) {
    console.error('Delete newsletter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Upload/replace newsletter image
export async function uploadNewsletterImage(
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

    const newsletter = await prisma.newsletter.findUnique({
      where: { id },
    });

    if (!newsletter) {
      res.status(404).json({ error: 'Newsletter not found' });
      return;
    }

    if (newsletter.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only edit your own newsletters' });
      return;
    }

    const filePath = generateFilePath('newsletter', id, file!.originalname);
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
    console.error('Upload newsletter image error:', error);
    res.status(400).json({ error: error.message || 'Failed to upload image' });
  }
}

// Delete newsletter image
export async function deleteNewsletterImage(
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

    const newsletter = await prisma.newsletter.findUnique({
      where: { id },
    });

    if (!newsletter) {
      res.status(404).json({ error: 'Newsletter not found' });
      return;
    }

    if (newsletter.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own newsletters' });
      return;
    }

    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({
        error:
          'filePath is required. Inline images are controlled by the editor; orphaned images are purged on save.',
      });
      return;
    }

    if (!filePath.startsWith(`newsletters/${id}/`)) {
      res.status(400).json({ error: 'Invalid filePath for this newsletter' });
      return;
    }

    await deleteFile(filePath);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: { filePath },
    });
  } catch (error) {
    console.error('Delete newsletter image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
}