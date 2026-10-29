import {promises as fs} from 'node:fs';import path from 'node:path';import {getJob,renderDir} from '../../../../../lib/server/render';import {apiError} from '../../../../../lib/server/store';
export const runtime='nodejs';
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){try{const job=await getJob((await params).id);if(!['queued','processing'].includes(job.status))throw new Error('진행 중인 렌더만 취소할 수 있습니다.');await fs.writeFile(path.join(renderDir(job.id),'cancel'),'requested');return Response.json({requested:true});}catch(e){return apiError(e);}}
