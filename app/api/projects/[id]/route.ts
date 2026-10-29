import {promises as fs} from 'node:fs';
import {fileFor,readJson,saveProject,apiError} from '../../../../lib/server/store';
import type {Project} from '../../../../lib/model';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await readJson<Project>(fileFor('projects',(await params).id)));}catch(e){return apiError(e,404);}}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await saveProject(await request.json(),(await params).id));}catch(e){return apiError(e);}}
export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){try{await fs.unlink(fileFor('projects',(await params).id));return Response.json({ok:true});}catch(e){return apiError(e,404);}}
