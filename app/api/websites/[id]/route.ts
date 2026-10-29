import {getWebsite, saveWebsite} from '../../../../lib/server/websites';
import {apiError} from '../../../../lib/server/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = {params: Promise<{id: string}>};
export async function GET(_request: Request, {params}: Context) {
  try { return Response.json(await getWebsite((await params).id)); }
  catch (error) { return apiError(error, 404); }
}
export async function PATCH(request: Request, {params}: Context) {
  const {id} = await params;
  try { await getWebsite(id); } catch (error) { return apiError(error, 404); }
  try { return Response.json(await saveWebsite(await request.json(), id)); }
  catch (error) { return apiError(error); }
}
