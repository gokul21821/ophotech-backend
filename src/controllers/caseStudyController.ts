import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../db';
import { Prisma } from '@prisma/client';
import { deleteFile, getPublicUrl, uploadFile } from '../services/supabaseClient';
import { generateFilePath, validateImageFile } from '../middleware/uploadMiddleware';
import { extractPlainTextFromTiptap, findFirstImageAttrs } from '../utils/tiptap';
import { deleteAllContentImages, syncStorageWithContent } from '../utils/syncImages';

// Create a draft case study (protected)
export async function createCaseStudyDraft(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const caseStudy = await prisma.caseStudy.create({
      data: {
        title: '',
        content: { type: 'doc', content: [] }, // Empty TipTap doc for draft
        category: null,
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
        ...caseStudy,
        imageUrl: null,
      },
    });
  } catch (error) {
    console.error('Create case study draft error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get all case studies (public)
export async function getAllCaseStudies(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const caseStudies = await prisma.caseStudy.findMany({
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
    const publishedCaseStudies = caseStudies.filter((c) => {
      const content = c.content as any;
      return content?.content && Array.isArray(content.content) && content.content.length > 0;
    });

    const dataWithUrls = publishedCaseStudies.map((c) => ({
      ...c,
      imageUrl: findFirstImageAttrs(c.content)?.src ?? null,
    }));

    res.status(200).json({
      success: true,
      count: dataWithUrls.length,
      data: dataWithUrls,
    });
  } catch (error) {
    console.error('Get case studies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get single case study by ID
export async function getCaseStudyById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const caseStudy = await prisma.caseStudy.findUnique({
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

    if (!caseStudy) {
      res.status(404).json({ error: 'Case study not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...caseStudy,
        imageUrl: findFirstImageAttrs(caseStudy.content)?.src ?? null,
      },
    });
  } catch (error) {
    console.error('Get case study error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create new case study (protected)
export async function createCaseStudy(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { title, date, category, content } = req.body as {
      title?: string;
      date?: string;
      category?: string;
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

    const categoryValue =
      typeof category === 'string' ? (category.trim() ? category.trim() : null) : null;

    // Create case study
    const caseStudy = await prisma.caseStudy.create({
      data: {
        title: title.trim(),
        content: content as Prisma.InputJsonValue,
        category: categoryValue,
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
      await syncStorageWithContent('caseStudy', caseStudy.id, content);
    } catch (syncErr) {
      console.error('Case study image sync error:', syncErr);
    }

    res.status(201).json({
      success: true,
      message: 'Case study created successfully',
      data: {
        ...caseStudy,
        imageUrl: findFirstImageAttrs(caseStudy.content)?.src ?? null,
      },
    });
  } catch (error) {
    console.error('Create case study error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update case study (protected - only author or admin)
export async function updateCaseStudy(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { title, date, category, content } = req.body as {
      title?: string;
      date?: string;
      category?: string;
      content?: unknown;
    };

    // Find case study
    const caseStudy = await prisma.caseStudy.findUnique({
      where: { id },
    });

    if (!caseStudy) {
      res.status(404).json({ error: 'Case study not found' });
      return;
    }

    // Check authorization (only author or admin can edit)
    if (caseStudy.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only edit your own case studies' });
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

    // Update case study
    const parsedDate = date ? new Date(date) : undefined;
    const finalDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined;

    // If category is omitted, leave unchanged; if empty string, clear to null.
    const categoryValue =
      typeof category === 'string' ? (category.trim() ? category.trim() : null) : undefined;

    const updatedCaseStudy = await prisma.caseStudy.update({
      where: { id },
      data: {
        title: title.trim(),
        content: content as Prisma.InputJsonValue,
        date: finalDate,
        category: categoryValue,
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
      await syncStorageWithContent('caseStudy', id, content);
    } catch (syncErr) {
      console.error('Case study image sync error:', syncErr);
    }

    res.status(200).json({
      success: true,
      message: 'Case study updated successfully',
      data: {
        ...updatedCaseStudy,
        imageUrl: findFirstImageAttrs(updatedCaseStudy.content)?.src ?? null,
      },
    });
  } catch (error) {
    console.error('Update case study error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete case study (protected - only author or admin)
export async function deleteCaseStudy(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Find case study
    const caseStudy = await prisma.caseStudy.findUnique({
      where: { id },
    });

    if (!caseStudy) {
      res.status(404).json({ error: 'Case study not found' });
      return;
    }

    // Check authorization (only author or admin can delete)
    if (caseStudy.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own case studies' });
      return;
    }

    // Delete all images under case-studies/<id>/ (inline images)
    try {
      await deleteAllContentImages('caseStudy', id);
    } catch (storageErr) {
      console.error('Delete case study folder images error:', storageErr);
    }

    await prisma.caseStudy.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Case study deleted successfully',
    });
  } catch (error) {
    console.error('Delete case study error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Upload/replace case study image
export async function uploadCaseStudyImage(
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

    const caseStudy = await prisma.caseStudy.findUnique({ where: { id } });
    if (!caseStudy) {
      res.status(404).json({ error: 'Case study not found' });
      return;
    }

    if (caseStudy.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only edit your own case studies' });
      return;
    }

    const filePath = generateFilePath('caseStudy', id, file!.originalname);
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
    console.error('Upload case study image error:', error);
    res.status(400).json({ error: error.message || 'Failed to upload image' });
  }
}

// Delete case study image
export async function deleteCaseStudyImage(
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
    const caseStudy = await prisma.caseStudy.findUnique({ where: { id } });

    if (!caseStudy) {
      res.status(404).json({ error: 'Case study not found' });
      return;
    }

    if (caseStudy.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own case studies' });
      return;
    }

    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({
        error:
          'filePath is required. Inline images are controlled by the editor; orphaned images are purged on save.',
      });
      return;
    }

    if (!filePath.startsWith(`case-studies/${id}/`)) {
      res.status(400).json({ error: 'Invalid filePath for this case study' });
      return;
    }

    await deleteFile(filePath);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: { filePath },
    });
  } catch (error) {
    console.error('Delete case study image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
}