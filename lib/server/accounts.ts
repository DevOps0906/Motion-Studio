import 'server-only';
import {createHash, randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir, readFile, writeFile, unlink} from 'node:fs/promises';
import path from 'node:path';
const derive = promisify(scrypt);
const root = path.join(process.cwd(), '.local-data', 'accounts');
const hash = (value:string) => createHash('sha256').update(value).digest('hex');
const lifetime = 7 * 24 * 60 * 60;
export const SESSION_COOKIE = 'motion-studio-session';
type Account = {name:string;email:string;salt:string;passwordHash:string};
export type AccountIdentity = Pick<Account, 'name'|'email'>;
const attempts = new Map<string,{count:number;until:number}>();
function limit(email:string){
  const key=hash(email), now=Date.now();
  for(const [id,item] of attempts)if(item.until<=now)attempts.delete(id);
  const current=attempts.get(key)||{count:0,until:now+15*60_000};
  if(current.count>=15||attempts.size>=2000)throw new Error('로그인 시도가 많습니다. 잠시 후 다시 시도하세요.');
  current.count++;attempts.set(key,current);
}
function cookie(request:Request){return request.headers.get('cookie')?.split(';').map(item=>item.trim()).find(item=>item.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1)||'';}
export function sessionHeader(token:string, request:Request){return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?lifetime:0}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function currentAccount(request:Request):Promise<AccountIdentity|null>{
 const token=cookie(request);if(!/^[a-f0-9]{64}$/.test(token))return null;
 try{const filename=path.join(root,'sessions',hash(token)+'.json');const session=JSON.parse(await readFile(filename,'utf8'));if(session.expires<=Date.now()){await unlink(filename).catch(()=>{});return null;}return {name:session.name,email:session.email};}catch{return null;}
}
export async function endSession(request:Request){const token=cookie(request);if(/^[a-f0-9]{64}$/.test(token))await unlink(path.join(root,'sessions',hash(token)+'.json')).catch(()=>{});}
export async function authenticate(input:unknown){
 const data=input as Record<string,unknown>;
 if(!data||!['login','register'].includes(String(data.action)))throw new Error('요청을 확인해 주세요.');
 const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
 const password=typeof data.password==='string'?data.password:'';
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>200)throw new Error('이메일과 8~200자 비밀번호를 입력해 주세요.');
 limit(email);
 await mkdir(path.join(root,'users'),{recursive:true});await mkdir(path.join(root,'sessions'),{recursive:true});
 const file=path.join(root,'users',hash(email)+'.json');let account:Account;
 if(data.action==='register'){
   const name=typeof data.name==='string'?data.name.trim():'';if(!name||name.length>80)throw new Error('표시 이름을 1~80자로 입력해 주세요.');
   const salt=randomBytes(16).toString('hex'),passwordHash=(await derive(password,salt,64) as Buffer).toString('hex');
   account={name,email,salt,passwordHash};
   try{await writeFile(file,JSON.stringify(account),{flag:'wx',mode:0o600});}catch{throw new Error('계정을 만들 수 없습니다. 이미 가입했다면 로그인해 주세요.');}
 }else{
   let found:Account|null=null;try{found=JSON.parse(await readFile(file,'utf8'));}catch{}
   const actual=await derive(password,found?.salt||'missing-account-salt',64) as Buffer;
   if(!found||!timingSafeEqual(actual,Buffer.from(found.passwordHash,'hex')))throw new Error('이메일 또는 비밀번호를 확인해 주세요.');
   account=found;
 }
 const token=randomBytes(32).toString('hex'),identity={name:account.name,email:account.email};
 await writeFile(path.join(root,'sessions',hash(token)+'.json'),JSON.stringify({...identity,expires:Date.now()+lifetime*1000}),{flag:'wx',mode:0o600});
 attempts.delete(hash(email));
 return {token,identity};
}
