import { apiError } from '../../../../../lib/server/store';
import { streamCadModel } from '../../../../../lib/server/cad-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await streamCadModel((await context.params).id, request); }
  catch (error) { return apiError(error, 404); }
}
