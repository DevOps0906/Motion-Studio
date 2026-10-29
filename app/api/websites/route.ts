import {listWebsites, saveWebsite} from '../../../lib/server/websites';
import {apiError} from '../../../lib/server/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json(await listWebsites()); }
  catch (error) { return apiError(error, 500); }
}
export async function POST(request: Request) {
  try { return Response.json(await saveWebsite(await request.json()), {status: 201}); }
  catch (error) { return apiError(error); }
}
