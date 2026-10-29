import { apiError } from '../../../../lib/server/store';
import { deleteCadModel, getCadModel } from '../../../../lib/server/cad-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getCadModel((await context.params).id)); }
  catch (error) { return apiError(error, 404); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json(await deleteCadModel((await context.params).id)); }
  catch (error) { return apiError(error, 404); }
}
