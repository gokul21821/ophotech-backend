import { Request } from 'express';

// User types
export interface User {
      id: string;
      email: string;
      username: string;
      role: 'admin' | 'editor';
      createdAt: Date;
      updatedAt: Date;
    }
    
    export interface AuthResponse {
      user: Omit<User, 'password'>;
      token: string;
    }
    
    // Content types
    export interface Newsletter {
      id: string;
      title: string;
      description: string;
      date: Date;
      authorId: string;
      createdAt: Date;
      updatedAt: Date;
    }
    
    export interface Blog {
      id: string;
      title: string;
      description: string;
      date: Date;
      authorId: string;
      createdAt: Date;
      updatedAt: Date;
    }
    
    export interface CaseStudy {
      id: string;
      title: string;
      description: string;
      date: Date;
      authorId: string;
      createdAt: Date;
      updatedAt: Date;
    }
    
    // Request types
    export interface AuthenticatedRequest extends Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }

    // Login/Register request bodies
    export interface LoginRequest {
      email: string;
      password: string;
    }

    export interface RegisterRequest {
      email: string;
      username: string;
      password: string;
      confirmPassword?: string;
    }

    // Authentication responses
    export interface AuthSuccessResponse {
      success: true;
      user: {
        id: string;
        email: string;
        username: string;
        role: string;
      };
      token: string;
    }

    export interface AuthErrorResponse {
      success: false;
      error: string;
    }