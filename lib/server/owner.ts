import 'server-only';
import {appendFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {isAdminEmail,listAccounts} from '../account-store';
import {currentAccount} from './accounts';
// Per-account data separation. Every route resolves an Actor from the session and checks records through this file only.
// Another account's item and a missing item are the same fixed 404, so existence cannot be probed.
export type Actor={id:string;operator:boolean};
export type AuditAction='view'|'delete';
export type RecordAction='view'|'delete'|'change';
export class NotFoundError extends Error{constructor(){super('찾을 수 없습니다.');}}
const noStore={'Cache-Control':'no-store'};
export const notFoundResponse=()=>Response.json({error:'찾을 수 없습니다.'},{status:404,headers:noStore});
// Session without an id (logged in before migrate:owner) must log in again; never guess an owner.
export async function authorize(request:Request):Promise<Actor|Response>{
 const account=await currentAccount(request);
 if(!account?.id)return Response.json({error:'로그인이 필요합니다.'},{status:401,headers:noStore});
 return {id:account.id,operator:isAdminEmail(account.email)};
}
// One line of JSON per foreign item the operator looked at or deleted. No email, name, message text or IP.
export async function audit(actor:Actor,action:AuditAction,kind:string,targets:{id:string;ownerId?:string}[]){
 if(!targets.length)return;
 const file=path.join(process.cwd(),'.local-data','audit.log');
 await mkdir(path.dirname(file),{recursive:true});
 const at=new Date().toISOString();
 await appendFile(file,targets.map(target=>JSON.stringify({at,operator:actor.id,action,kind,id:target.id,ownerId:target.ownerId??null})).join('\n')+'\n',{mode:0o600});
}
// Own item: always. Item without owner: operator only (an operator whose account has an id; before migrate:owner accounts without id get 401 everywhere).  Another account's item: operator may view/delete (audited), never change.
export async function allow(actor:Actor,record:{id?:string;ownerId?:string}|null|undefined,kind:string,id:string,action:RecordAction){
 if(!record)throw new NotFoundError();
 if(record.ownerId===actor.id)return;
 if(actor.operator){
  if(!record.ownerId)return;
  if(action!=='change'){await audit(actor,action,kind,[{id,ownerId:record.ownerId}]);return;}
 }
 throw new NotFoundError();
}
// Lists: own items by default. Operator with ?owner=all gets every item; foreign ones are audited as views. `shared` items (sample media) belong to nobody.
export async function visible<T extends {id:string;ownerId?:string}>(actor:Actor,request:Request,kind:string,records:T[],shared:(record:T)=>boolean=()=>false):Promise<T[]>{
 const all=actor.operator&&new URL(request.url).searchParams.get('owner')==='all';
 if(!all)return records.filter(record=>shared(record)||record.ownerId===actor.id);
 await audit(actor,'view',kind,records.filter(record=>!shared(record)&&record.ownerId&&record.ownerId!==actor.id));
 return records;
}
// Display-only label for the operator's all-accounts view: account name plus masked email (sk***@gmail.com). Never the raw email.
export function maskEmail(email:string){const [local,domain]=email.split('@');return domain?`${local.length>2?local.slice(0,2):''}***@${domain}`:'***';}
export async function ownerLabels(){return new Map((await listAccounts()).filter(account=>account.id).map(account=>[account.id as string,`${account.name} (${maskEmail(account.email)})`]));}
