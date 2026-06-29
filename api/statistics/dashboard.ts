import { authedHandler, assertMethod } from '../_lib/handler.js';
import { ApiError } from '../_lib/errors.js';

// GET /api/statistics/dashboard
// Single round-trip dashboard payload computed in Postgres
// (supabase/migrations/0005_dashboard_function.sql).
export default authedHandler(async ({ client }, req) => {
  assertMethod(req, ['GET']);
  const { data, error } = await client.rpc('dashboard_summary');
  if (error) throw new ApiError('INTERNAL', 'Failed to load dashboard', error);
  return data;
});
