import {getOwnedWebsite, saveWebsite} from '../../../../lib/server/websites';
import {apiError} from '../../../../lib/server/store';
import {authorize} from '../../../../lib/server/owner';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = {params: Promise<{id: string}>};
export async function GET(request: Request, {params}: Context) {
  try { const actor=await authorize(request);if(actor instanceof Response)return actor; return Response.json(await getOwnedWebsite((await params).id, actor)); }
  catch (error) { return apiError(error, 404); }
}
export async function PATCH(request: Request, {params}: Context) {
  try {
    const actor=await authorize(request);if(actor instanceof Response)return actor;
    const {id} = await params;
    await getOwnedWebsite(id, actor, 'change');
    return Response.json(await saveWebsite(await request.json(), id, actor));
  }
  catch (error) { return apiError(error); }
}
