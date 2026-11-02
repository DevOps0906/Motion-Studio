import { apiError } from '../../../../../lib/server/store';
import { createCadView, limitBody, listCadViews } from '../../../../../lib/server/cad-models';
import { authorize } from '../../../../../lib/server/owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = await authorize(request); if (actor instanceof Response) return actor; return Response.json(await listCadViews((await context.params).id, actor)); }
  catch (error) { return apiError(error, 404); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorize(request); if (actor instanceof Response) return actor;
    const { id } = await context.params;
    const tooBig = limitBody(request); if (tooBig) return tooBig;
    const body: unknown = await request.json().catch(() => undefined);
    return Response.json(await createCadView(id, body, actor), { status: 201 });
  } catch (error) { return apiError(error); }
}
