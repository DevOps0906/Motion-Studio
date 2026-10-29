import path from 'node:path';
import {DATA,listJson,createProject,apiError} from '../../../lib/server/store';
import type {Project} from '../../../lib/model';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{return Response.json((await listJson<Project>(path.join(DATA,'projects'))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));}catch(e){return apiError(e,500);}}
export async function POST(request:Request){try{const data=await request.json();return Response.json(await createProject(data.title??'나의 첫 인트로',data.photos??[],data.template??'mosaic'),{status:201});}catch(e){return apiError(e);}}
