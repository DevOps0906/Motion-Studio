import type {Instrumentation} from 'next';
// One-line JSON server error log on stdout: time, path and status only (no query string, body, headers or error text).
export function logServerError(path:string,status:number){
 const clean=String(path||'').split('?')[0].slice(0,200);
 process.stdout.write(JSON.stringify({time:new Date().toISOString(),level:'error',path:clean,status})+'\n');
}
// Next.js instrumentation hook, re-exported from the root instrumentation.ts: unhandled server errors become one JSON line.
export const onRequestError:Instrumentation.onRequestError=(_error,request)=>{logServerError(request.path,500);};
