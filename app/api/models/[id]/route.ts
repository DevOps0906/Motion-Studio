import { apiError } from '../../../../lib/server/store';
import { deleteCadModel, getOwnedModel } from '../../../../lib/server/cad-models';
import { authorize } from '../../../../lib/server/owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor=await authorize(request);if(actor instanceof Response)return actor; return Response.json(await getOwnedModel((await context.params).id, actor)); }
  catch (error) { return apiError(error, 404); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor=await authorize(request);if(actor instanceof Response)return actor; return Response.json(await deleteCadModel((await context.params).id, actor)); }
  catch (error) { return apiError(error, 404); }
}
