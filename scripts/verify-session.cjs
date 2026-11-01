// task-005: API calls need a session. Requiring this file patches global fetch so requests to the verify server carry one.
// The verify server must run with SIGNUP_ENABLED=true (and REQUIREMENTS_ADMIN_EMAILS for operator checks), or set
// VERIFY_EMAIL / VERIFY_PASSWORD to log in with an existing account (e.g. one made by npm run account:create).
const {randomUUID}=require('crypto');
const base=(process.env.VERIFY_BASE||'http://127.0.0.1:4101').replace(/\/+$/,''),original=globalThis.fetch;
let pending;
async function session(){
 const email=process.env.VERIFY_EMAIL||`verify-${randomUUID()}@example.test`,password=process.env.VERIFY_PASSWORD||randomUUID()+'Aa9!';
 const body=process.env.VERIFY_EMAIL?{action:'login',email,password}:{action:'register',name:'검증 계정',email,password};
 const response=await original(base+'/api/auth',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw Error(`verify session failed (${response.status}). Start the server with SIGNUP_ENABLED=true or set VERIFY_EMAIL/VERIFY_PASSWORD.`);
 return response.headers.get('set-cookie').split(';')[0];
}
const sessionCookie=()=>pending||(pending=session());
globalThis.fetch=async(input,init={})=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(!url.startsWith(base))return original(input,init);
 const headers=new Headers(init.headers);if(!headers.has('cookie'))headers.set('cookie',await sessionCookie());
 return original(input,{...init,headers});
};
// Browser pages (Remotion openBrowser/CDP) need the same cookie before visiting private pages.
async function authorizePage(page){const [name,value]=(await sessionCookie()).split('=');await page._client().send('Network.setCookie',{name,value,url:base,httpOnly:true,sameSite:'Lax'});}
module.exports={sessionCookie,authorizePage,base};
