import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'));
  }
  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

export function validateImageFile(file?: Express.Multer.File): void {
  if (!file) {
    throw new Error('No file uploaded');
  }
  if (!file.mimetype.startsWith('image/')) {
    throw new Error('File must be an image');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size must be under 5MB');
  }
}

const folderMap: Record<string, string> = {
  newsletter: 'newsletters',
  blog: 'blogs',
  caseStudy: 'case-studies',
};

export function generateFilePath(
  contentType: 'newsletter' | 'blog' | 'caseStudy',
  contentId: string,
  originalFilename: string
): string {
  const folder = folderMap[contentType] || contentType;
  const ext = originalFilename.split('.').pop() || 'jpg';
  const uniqueName = `${uuidv4()}.${ext}`;
  return `${folder}/${contentId}/${uniqueName}`;
}

