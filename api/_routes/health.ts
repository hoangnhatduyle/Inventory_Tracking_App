import { withErrorHandler } from '../_lib/errors.js';
import { applyCors } from '../_lib/cors.js';

// Public health probe. No auth required, no secrets exposed.
export default withErrorHandler(async (req, res) => {
  if (applyCors(req, res)) return;
  return { status: 'ok', time: new Date().toISOString() };
});
