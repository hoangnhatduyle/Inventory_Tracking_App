import { z, type ZodSchema } from 'zod';
import type { VercelRequest } from '@vercel/node';
import { ApiError } from './errors.js';

export function parseBody<T>(req: VercelRequest, schema: ZodSchema<T>): T {
  if (req.body == null) {
    throw new ApiError('BAD_REQUEST', 'Request body is required');
  }
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new ApiError('BAD_REQUEST', 'Invalid request body', result.error.flatten());
  }
  return result.data;
}

export function parseQuery<T>(req: VercelRequest, schema: ZodSchema<T>): T {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw new ApiError('BAD_REQUEST', 'Invalid query parameters', result.error.flatten());
  }
  return result.data;
}

// ----- shared field constraints --------------------------------------------

export const idSchema = z.coerce.number().int().positive();

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const positiveNumber = z.coerce.number().nonnegative();

export const optionalText = (max = 500) =>
  z.string().trim().max(max).optional().nullable();

export const requiredText = (max = 200) =>
  z.string().trim().min(1).max(max);
