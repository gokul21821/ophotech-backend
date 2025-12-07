import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import newsletterRoutes from './routes/newsletters';
import blogRoutes from './routes/blogs'; // Add this import
import caseStudyRoutes from './routes/caseStudies'; // Add this import

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.API_PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Routes
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'Backend is running!', timestamp: new Date() });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Newsletter routes
app.use('/api/newsletters', newsletterRoutes);

// Blog routes
app.use('/api/blogs', blogRoutes); // Add this line

// Case study routes
app.use('/api/case-studies', caseStudyRoutes); // Add this line

// Basic error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth routes: http://localhost:${PORT}/api/auth`);
  console.log(`📰 Newsletter routes: http://localhost:${PORT}/api/newsletters`);
  console.log(`📝 Blog routes: http://localhost:${PORT}/api/blogs`);
  console.log(`🎯 Case study routes: http://localhost:${PORT}/api/case-studies`);
});