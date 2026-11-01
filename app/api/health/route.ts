import {randomUUID} from 'node:crypto';
import {mkdir,statfs,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {logServerError} from '../../../lib/server/error-log';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
// Only "ok" or "unavailable": no paths, versions or numbers. Data folder must be writable and have HEALTH_MIN_FREE_MB free (default 1024).
export async function GET(){
 const data=path.join(process.cwd(),'.local-data');
 try{
  await mkdir(data,{recursive:true});
  const probe=path.join(data,`.health-${randomUUID()}`);await writeFile(probe,'ok',{mode:0o600});await unlink(probe);
  const disk=await statfs(data),minimum=Math.max(0,Number(process.env.HEALTH_MIN_FREE_MB??1024)||0)*1024*1024;
  if(Number(disk.bavail)*Number(disk.bsize)<minimum)throw Error('low disk');
  return Response.json({status:'ok'},{headers});
 }catch{logServerError('/api/health',503);return Response.json({status:'unavailable'},{status:503,headers});}
}
