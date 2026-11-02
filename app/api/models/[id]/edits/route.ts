import { apiError } from '../../../../../lib/server/store';
import { HttpError, getCadEdits, limitBody, saveCadEdits } from '../../../../../lib/server/cad-models';
import { authorize } from '../../../../../lib/server/owner';
import { EDIT_LIMITS } from '../../../../../lib/cad-edits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = await authorize(request); if (actor instanceof Response) return actor; return Response.json(await getCadEdits((await context.params).id, actor)); }
  catch (error) { return apiError(error, 404); }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorize(request); if (actor instanceof Response) return actor;
    const { id } = await context.params;
    const tooBig = limitBody(request, EDIT_LIMITS.maxBodyBytes); if (tooBig) return tooBig;
    // Content-Length can lie; the real body is measured too.
    const text = await request.text();
    if (Buffer.byteLength(text) > EDIT_LIMITS.maxBodyBytes) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    let body: unknown; try { body = JSON.parse(text); } catch { body = undefined; }
    return Response.json(await saveCadEdits(id, body, actor));
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message, ...error.extra }, { status: error.status });
    return apiError(error);
  }
}
