import 'server-only';
import {SESSION_COOKIE,SESSION_LIFETIME,createSession,deleteSession,hashValue,normalizeEmail,readAccount,readSession,sessionToken,validCredentials,verifyPassword,writeAccount,type AccountIdentity} from '../account-store';
export {SESSION_COOKIE};
export type {AccountIdentity};
// Per-email window for every email; the short global window counts only emails with no account file, so floods of unknown emails never lock out real accounts. Old records are dropped instead of blocking everyone.
export function createLoginLimiter({emailLimit=15,emailWindow=15*60_000,globalLimit=300,globalWindow=60_000,maxTracked=2000}={}){
 const attempts=new Map<string,{count:number;until:number}>();
 let global={count:0,until:0};
 return {
  attempt(email:string,now=Date.now(),known=false){
   const key=hashValue(email);
   for(const [id,item] of attempts)if(item.until<=now)attempts.delete(id);
   if(global.until<=now)global={count:0,until:now+globalWindow};
   const current=attempts.get(key)||{count:0,until:now+emailWindow};
   if(current.count>=emailLimit||(!known&&global.count>=globalLimit))throw new Error('로그인 시도가 많습니다. 잠시 후 다시 시도하세요.');
   current.count++;if(!known)global.count++;attempts.delete(key);attempts.set(key,current);
   while(attempts.size>maxTracked)attempts.delete(attempts.keys().next().value as string);
  },
  success(email:string){attempts.delete(hashValue(email));},
  get tracked(){return attempts.size;},
 };
}
const limiter=createLoginLimiter();
export function signupEnabled(){
 const flag=process.env.SIGNUP_ENABLED;
 return flag===undefined||flag===''?process.env.NODE_ENV!=='production':flag==='true';
}
export function sessionHeader(token:string, request:Request){return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?SESSION_LIFETIME:0}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function currentAccount(request:Request):Promise<AccountIdentity|null>{return readSession(sessionToken(request.headers.get('cookie')));}
export async function endSession(request:Request){await deleteSession(sessionToken(request.headers.get('cookie')));}
export async function authenticate(input:unknown){
 const data=input as Record<string,unknown>;
 if(!data||!['login','register'].includes(String(data.action)))throw new Error('요청을 확인해 주세요.');
 if(data.action==='register'&&!signupEnabled())throw new Error('새 계정 가입이 닫혀 있습니다. 운영자에게 계정을 요청해 주세요.');
 const email=normalizeEmail(data.email);
 const password=typeof data.password==='string'?data.password:'';
 if(!validCredentials(email,password))throw new Error('이메일과 8~200자 비밀번호를 입력해 주세요.');
 limiter.attempt(email,Date.now(),data.action==='login'&&Boolean(await readAccount(email)));
 let identity:AccountIdentity;
 if(data.action==='register'){
   const name=typeof data.name==='string'?data.name.trim():'';if(!name||name.length>80)throw new Error('표시 이름을 1~80자로 입력해 주세요.');
   try{await writeAccount({name,email,password});}catch{throw new Error('계정을 만들 수 없습니다. 이미 가입했다면 로그인해 주세요.');}
   identity={name,email};
 }else{
   const found=await verifyPassword(email,password);
   if(!found)throw new Error('이메일 또는 비밀번호를 확인해 주세요.');
   identity={name:found.name,email:found.email};
 }
 const token=await createSession(identity);
 limiter.success(email);
 return {token,identity};
}
