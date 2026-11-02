import { apiError } from '../../../../../lib/server/store';
import { streamCadModel } from '../../../../../lib/server/cad-models';
import { authorize } from '../../../../../lib/server/owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor=await authorize(request);if(actor instanceof Response)return actor; return await streamCadModel((await context.params).id, request, actor); }
  catch (error) { return apiError(error, 404); }
}
