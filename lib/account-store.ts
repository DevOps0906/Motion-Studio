// Shared account file format (no 'server-only'): used by lib/server/accounts.ts, proxy.ts and scripts/account-create.cjs.
// Keep erasable TypeScript syntax only so Node can load this file directly (type stripping).
import {createHash, randomBytes, randomUUID, scrypt, timingSafeEqual} from 'node:crypto';
import {mkdir, readFile, readdir, rename, writeFile, unlink} from 'node:fs/promises';
import path from 'node:path';
export const SESSION_COOKIE = 'motion-studio-session';
export const SESSION_LIFETIME = 7 * 24 * 60 * 60;
// id = ownerId of every stored item. Issued only by account:create / migrate:owner (and dev signup); never backfilled at runtime.
export type Account = {id?:string;name:string;email:string;salt:string;passwordHash:string};
export type AccountIdentity = Pick<Account, 'name'|'email'|'id'>;
export const accountsRoot = () => path.join(process.cwd(), '.local-data', 'accounts');
export const hashValue = (value:string) => createHash('sha256').update(value).digest('hex');
const userFile = (email:string) => path.join(accountsRoot(), 'users', hashValue(email) + '.json');
const sessionFile = (token:string) => path.join(accountsRoot(), 'sessions', hashValue(token) + '.json');
// Operator = only emails listed in REQUIREMENTS_ADMIN_EMAILS (no localhost exception).
export function isAdminEmail(email:string){return (process.env.REQUIREMENTS_ADMIN_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());}
export function normalizeEmail(value:unknown){return typeof value==='string'?value.trim().toLowerCase():'';}
export function validCredentials(email:string,password:string){return email.length<=254&&/^\S+@\S+\.\S+$/.test(email)&&password.length>=8&&password.length<=200;}
export function derivePassword(password:string,salt:string){
 return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key)));
}
export async function readAccount(email:string):Promise<Account|null>{try{return JSON.parse(await readFile(userFile(email),'utf8'));}catch{return null;}}
export async function verifyPassword(email:string,password:string){
 const found=await readAccount(email);
 const actual=await derivePassword(password,found?.salt||'missing-account-salt');
 return found&&timingSafeEqual(actual,Buffer.from(found.passwordHash,'hex'))?found:null;
}
// overwrite=false: fails when the email already exists (flag 'wx').
export async function writeAccount(input:{name:string;email:string;password:string},overwrite=false){
 await mkdir(path.join(accountsRoot(),'users'),{recursive:true,mode:0o700});
 const salt=randomBytes(16).toString('hex'),passwordHash=(await derivePassword(input.password,salt)).toString('hex');
 // overwrite=true keeps the existing id so data stays with the account after a password reset.
 const previous=overwrite?await readAccount(input.email):null;
 const account:Account={id:previous?previous.id:randomUUID(),name:input.name,email:input.email,salt,passwordHash};
 if(account.id===undefined)delete account.id;
 await writeFile(userFile(input.email),JSON.stringify(account),{flag:overwrite?'w':'wx',mode:0o600});
 return account;
}
export async function createSession(identity:AccountIdentity){
 await mkdir(path.join(accountsRoot(),'sessions'),{recursive:true,mode:0o700});
 const token=randomBytes(32).toString('hex');
 await writeFile(sessionFile(token),JSON.stringify({...(identity.id?{id:identity.id}:{}),name:identity.name,email:identity.email,expires:Date.now()+SESSION_LIFETIME*1000}),{flag:'wx',mode:0o600});
 return token;
}
export function sessionToken(cookieHeader:string|null|undefined){
 const token=cookieHeader?.split(';').map(item=>item.trim()).find(item=>item.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1)||'';
 return /^[a-f0-9]{64}$/.test(token)?token:'';
}
export async function readSession(token:string):Promise<AccountIdentity|null>{
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 try{const filename=sessionFile(token);const session=JSON.parse(await readFile(filename,'utf8'));if(session.expires<=Date.now()){await unlink(filename).catch(()=>{});return null;}return {...(typeof session.id==='string'&&session.id?{id:session.id}:{}),name:session.name,email:session.email};}catch{return null;}
}
export async function deleteSession(token:string){if(/^[a-f0-9]{64}$/.test(token))await unlink(sessionFile(token)).catch(()=>{});}
export async function revokeSessions(email:string){
 const directory=path.join(accountsRoot(),'sessions');let removed=0;
 for(const name of await readdir(directory).catch(()=>[] as string[])){
  if(!name.endsWith('.json'))continue;const file=path.join(directory,name);
  try{if(JSON.parse(await readFile(file,'utf8')).email===email){await unlink(file);removed++;}}catch{}
 }
 return removed;
}
// Server-stopped maintenance helpers (migrate:owner, account:delete).
export async function listAccounts():Promise<Account[]>{
 const directory=path.join(accountsRoot(),'users');const found:Account[]=[];
 for(const name of await readdir(directory).catch(()=>[] as string[])){if(!name.endsWith('.json'))continue;try{found.push(JSON.parse(await readFile(path.join(directory,name),'utf8')));}catch{}}
 return found;
}
export async function saveAccountRecord(account:Account){
 const file=userFile(account.email),temp=file+'.'+randomUUID()+'.tmp';
 await writeFile(temp,JSON.stringify(account),{mode:0o600});await rename(temp,file);
}
export async function deleteAccountFile(email:string){await unlink(userFile(email));}
export async function revokeAllSessions(){
 const directory=path.join(accountsRoot(),'sessions');let removed=0;
 for(const name of await readdir(directory).catch(()=>[] as string[])){if(!name.endsWith('.json'))continue;try{await unlink(path.join(directory,name));removed++;}catch{}}
 return removed;
}
