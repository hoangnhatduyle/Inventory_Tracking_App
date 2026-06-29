import type { VercelRequest, VercelResponse } from '@vercel/node';

// Consistent error envelope returned by every API endpoint:
//   { error: { code: string, message: string, details?: unknown } }
//
// `details` is only included in non-production for easier debugging; in
// production we never return internal information (stack traces, DB errors,
// upstream API messages) to the client. Audit findings M5 / M6 / M7 / M8.

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL';

const STATUS_FOR: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS_FOR[code];
    this.details = details;
  }
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

export function withErrorHandler(handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      const result = await handler(req, res);
      if (!res.headersSent) {
        res.status(200).json({ data: result ?? null });
      }
    } catch (err) {
      const isProd = process.env.NODE_ENV === 'production';

      if (err instanceof ApiError) {
        res.status(err.status).json({
          error: {
            code: err.code,
            message: err.message,
            ...(isProd ? {} : { details: err.details }),
          },
        });
        return;
      }

      // Unexpected error - log server-side, never leak details to client.
      console.error('[api] unhandled error', err);
      res.status(500).json({
        error: {
          code: 'INTERNAL',
          message: 'Internal server error',
          ...(isProd
            ? {}
            : { details: err instanceof Error ? err.message : String(err) }),
        },
      });
    }
  };
}

export function methodNotAllowed(allowed: string[]): never {
  throw new ApiError(
    'METHOD_NOT_ALLOWED',
    `Allowed methods: ${allowed.join(', ')}`,
  );
}
