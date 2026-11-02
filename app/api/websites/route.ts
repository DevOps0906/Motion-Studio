import {listWebsites, saveWebsite} from '../../../lib/server/websites';
import {apiError} from '../../../lib/server/store';
import {authorize, visible} from '../../../lib/server/owner';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { const actor=await authorize(request);if(actor instanceof Response)return actor; return Response.json(await visible(actor, request, 'website', await listWebsites())); }
  catch (error) { return apiError(error, 500); }
}
export async function POST(request: Request) {
  try { const actor=await authorize(request);if(actor instanceof Response)return actor; return Response.json(await saveWebsite(await request.json(), undefined, actor), {status: 201}); }
  catch (error) { return apiError(error); }
}
