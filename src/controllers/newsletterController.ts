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

    const dataWithUrls = newsletters.map((n) => ({
      ...n,
      imageUrl: n.imagePath ? getPublicUrl(n.imagePath) : null,
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
        imageUrl: newsletter.imagePath ? getPublicUrl(newsletter.imagePath) : null,
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

    const { title, description, date, edition } = req.body;

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

    const editionValue =
      typeof edition === 'string' ? (edition.trim() ? edition.trim() : null) : null;

    // Create newsletter
    const newsletter = await prisma.newsletter.create({
      data: {
        title: title.trim(),
        description: sanitizedDescription,
        edition: editionValue,
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
      message: 'Newsletter created successfully',
      data: {
        ...newsletter,
        imageUrl: newsletter.imagePath ? getPublicUrl(newsletter.imagePath) : null,
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
    const { title, description, date, edition } = req.body;

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
        description: sanitizedDescription,
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

    res.status(200).json({
      success: true,
      message: 'Newsletter updated successfully',
      data: {
        ...updatedNewsletter,
        imageUrl: updatedNewsletter.imagePath ? getPublicUrl(updatedNewsletter.imagePath) : null,
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

    // Delete newsletter
    if (newsletter.imagePath) {
      try {
        await deleteFile(newsletter.imagePath);
      } catch (storageErr) {
        console.error('Delete newsletter image error:', storageErr);
        // Continue even if storage deletion fails
      }
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

    // Delete old file if exists
    if (newsletter.imagePath) {
      try {
        await deleteFile(newsletter.imagePath);
      } catch (err) {
        console.error('Failed to delete old image:', err);
      }
    }

    const filePath = generateFilePath('newsletter', id, file!.originalname);
    await uploadFile(filePath, file!.buffer, file!.mimetype);

    const updated = await prisma.newsletter.update({
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

    if (!newsletter.imagePath) {
      res.status(400).json({ error: 'No image to delete' });
      return;
    }

    try {
      await deleteFile(newsletter.imagePath);
    } catch (err) {
      console.error('Failed to delete image from storage:', err);
    }

    const updated = await prisma.newsletter.update({
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
    console.error('Delete newsletter image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
}