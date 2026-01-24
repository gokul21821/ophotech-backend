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

    const dataWithUrls = caseStudies.map((c) => ({
      ...c,
      imageUrl: c.imagePath ? getPublicUrl(c.imagePath) : null,
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
        imageUrl: caseStudy.imagePath ? getPublicUrl(caseStudy.imagePath) : null,
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

    const { title, description, date, category } = req.body;

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

    const categoryValue =
      typeof category === 'string' ? (category.trim() ? category.trim() : null) : null;

    // Create case study
    const caseStudy = await prisma.caseStudy.create({
      data: {
        title: title.trim(),
        description: sanitizedDescription,
        category: categoryValue,
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
      message: 'Case study created successfully',
      data: {
        ...caseStudy,
        imageUrl: caseStudy.imagePath ? getPublicUrl(caseStudy.imagePath) : null,
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
    const { title, description, date, category } = req.body;

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
        description: sanitizedDescription,
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

    res.status(200).json({
      success: true,
      message: 'Case study updated successfully',
      data: {
        ...updatedCaseStudy,
        imageUrl: updatedCaseStudy.imagePath ? getPublicUrl(updatedCaseStudy.imagePath) : null,
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

    // Delete case study
    if (caseStudy.imagePath) {
      try {
        await deleteFile(caseStudy.imagePath);
      } catch (storageErr) {
        console.error('Delete case study image error:', storageErr);
      }
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

    if (caseStudy.imagePath) {
      try {
        await deleteFile(caseStudy.imagePath);
      } catch (err) {
        console.error('Failed to delete old image:', err);
      }
    }

    const filePath = generateFilePath('caseStudy', id, file!.originalname);
    await uploadFile(filePath, file!.buffer, file!.mimetype);

    const updated = await prisma.caseStudy.update({
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
    const caseStudy = await prisma.caseStudy.findUnique({ where: { id } });

    if (!caseStudy) {
      res.status(404).json({ error: 'Case study not found' });
      return;
    }

    if (caseStudy.authorId !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own case studies' });
      return;
    }

    if (!caseStudy.imagePath) {
      res.status(400).json({ error: 'No image to delete' });
      return;
    }

    try {
      await deleteFile(caseStudy.imagePath);
    } catch (err) {
      console.error('Failed to delete image from storage:', err);
    }

    const updated = await prisma.caseStudy.update({
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
    console.error('Delete case study image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
}