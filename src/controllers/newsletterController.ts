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

    res.status(200).json({
      success: true,
      count: newsletters.length,
      data: newsletters,
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
      data: newsletter,
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

    // Create newsletter
    const newsletter = await prisma.newsletter.create({
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
      message: 'Newsletter created successfully',
      data: newsletter,
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
    const updatedNewsletter = await prisma.newsletter.update({
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
      message: 'Newsletter updated successfully',
      data: updatedNewsletter,
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