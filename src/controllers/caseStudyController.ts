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

    res.status(200).json({
      success: true,
      count: caseStudies.length,
      data: caseStudies,
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
      data: caseStudy,
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

    // Create case study
    const caseStudy = await prisma.caseStudy.create({
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
      message: 'Case study created successfully',
      data: caseStudy,
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
    const updatedCaseStudy = await prisma.caseStudy.update({
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
      message: 'Case study updated successfully',
      data: updatedCaseStudy,
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