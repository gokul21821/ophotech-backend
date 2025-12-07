import { sign, verify, SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';

// JWT payload structure
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

// Generate JWT token
export function generateToken(payload: JWTPayload): string {
  const secret = process.env.JWT_SECRET;
  const expiresIn: StringValue | number = (process.env.JWT_EXPIRE || '7d') as StringValue;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const options: SignOptions = { expiresIn };
  return sign(payload, secret, options);
}
// Verify JWT token and extract payload
export function verifyToken(token: string): JWTPayload | null {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    const decoded = verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Extract token from Authorization header
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}