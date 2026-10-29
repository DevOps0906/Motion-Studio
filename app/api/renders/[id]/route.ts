import {getJob} from '../../../../lib/server/render';import {apiError} from '../../../../lib/server/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await getJob((await params).id));}catch(e){return apiError(e,404);}}
