import type { VercelRequest, VercelResponse } from '@vercel/node';
import { env } from './env.js';

// Strict CORS: only origins listed in API_ALLOWED_ORIGINS are accepted.
// If the env var is empty (e.g. local dev with curl), no Access-Control-Allow-Origin
// header is sent and the browser will block the request - that is intentional;
// configure the env var explicitly even in dev.

export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && env.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization,Content-Type,X-Requested-With',
    );
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
