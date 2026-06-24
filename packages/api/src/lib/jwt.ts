import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const JWT_SECRET = config.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
  userId: string;
  username: string;
  isAdmin?: boolean;
  discordId?: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function getJwtSecret(): string {
  return JWT_SECRET;
}
