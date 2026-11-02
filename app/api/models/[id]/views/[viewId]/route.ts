import { apiError } from '../../../../../../lib/server/store';
import { deleteCadView, getCadView, limitBody, updateCadView } from '../../../../../../lib/server/cad-models';
import { authorize } from '../../../../../../lib/server/owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; viewId: string }> };

export async function GET(request: Request, context: Context) {
  try { const actor = await authorize(request); if (actor instanceof Response) return actor; const { id, viewId } = await context.params; return Response.json(await getCadView(id, viewId, actor)); }
  catch (error) { return apiError(error, 404); }
}

export async function PUT(request: Request, context: Context) {
  try {
    const actor = await authorize(request); if (actor instanceof Response) return actor;
    const { id, viewId } = await context.params;
    const tooBig = limitBody(request); if (tooBig) return tooBig;
    const body: unknown = await request.json().catch(() => undefined);
    return Response.json(await updateCadView(id, viewId, body, actor));
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try { const actor = await authorize(request); if (actor instanceof Response) return actor; const { id, viewId } = await context.params; return Response.json(await deleteCadView(id, viewId, actor)); }
  catch (error) { return apiError(error, 404); }
}
