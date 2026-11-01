import 'server-only';
import {createRateLimiter} from '../inquiry';
// External alerts carry only "new inquiry · site title · admin link" — never the visitor's name, contact or message.
export type ChannelResult='sent'|'skipped'|'failed';
export type NotifyResults={email:ChannelResult;slack:ChannelResult;discord:ChannelResult};
type Env=Record<string,string|undefined>;
type Fetcher=(url:string,init:RequestInit)=>Promise<{ok:boolean}>;
const hourlyCap=createRateLimiter(30,60*60_000);
function parse(value:string|undefined){try{return value?new URL(value.trim()):null;}catch{return null;}}
export function slackWebhookUrl(value?:string){const url=parse(value);return url&&url.protocol==='https:'&&url.hostname==='hooks.slack.com'&&!url.port&&!url.username&&!url.password?url.href:'';}
export function discordWebhookUrl(value?:string){const url=parse(value);return url&&url.protocol==='https:'&&['discord.com','discordapp.com'].includes(url.hostname)&&!url.port&&!url.username&&!url.password&&url.pathname.startsWith('/api/webhooks/')?url.href:'';}
export function inquiryAdminLink(base?:string){
 const url=parse(base);if(!url||url.username||url.password)return '';
 const local=url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 return url.protocol==='https:'||local?new URL('/websites/inquiries',url.origin).href:'';
}
export const escapeSlack=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export const escapeDiscord=(value:string)=>value.replace(/[\\`*_~|>#\-[\]()<@:]/g,'\\$&');
// Site titles are customer-editable: break anything that could auto-link (scheme separators, domain dots).
export const defangTitle=(value:string)=>value.replace(/:\/\//g,'[:]//').replace(/([^\s.])\.(?=[^\s.])/g,'$1[.]');
export function inquiryAlertText(title:string,link:string,escape:(value:string)=>string=value=>value){
 const site=defangTitle((title.replace(/\s+/g,' ').trim()||'제목 없는 사이트').slice(0,120));
 return ['새 문의 1건',escape(site),link].filter(Boolean).join(' · ');
}
async function post(fetcher:Fetcher,url:string,body:unknown,headers:Record<string,string>={}):Promise<ChannelResult>{
 try{const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});return response.ok?'sent':'failed';}catch{return 'failed';}
}
export async function sendInquiryAlerts(title:string,env:Env=process.env,fetcher:Fetcher=fetch,now=Date.now()):Promise<NotifyResults>{
 const slackUrl=slackWebhookUrl(env.SLACK_WEBHOOK_URL),discordUrl=discordWebhookUrl(env.DISCORD_WEBHOOK_URL);
 const emailReady=!!(env.RESEND_API_KEY&&env.INQUIRY_EMAIL_FROM&&env.INQUIRY_EMAIL_TO);
 const skipped:NotifyResults={email:'skipped',slack:'skipped',discord:'skipped'};
 if(!slackUrl&&!discordUrl&&!emailReady)return skipped;
 if(!hourlyCap.allows('global',now))return skipped;
 hourlyCap.record('global',now);
 const link=inquiryAdminLink(env.APP_BASE_URL);
 const [email,slack,discord]=await Promise.all([
  emailReady?post(fetcher,'https://api.resend.com/emails',{from:env.INQUIRY_EMAIL_FROM,to:String(env.INQUIRY_EMAIL_TO).split(',').map(value=>value.trim()).filter(Boolean),subject:'새 문의 1건',text:inquiryAlertText(title,link)},{Authorization:`Bearer ${env.RESEND_API_KEY}`}):Promise.resolve<ChannelResult>('skipped'),
  slackUrl?post(fetcher,slackUrl,{text:inquiryAlertText(title,link,escapeSlack),unfurl_links:false,unfurl_media:false}):Promise.resolve<ChannelResult>('skipped'),
  discordUrl?post(fetcher,discordUrl,{content:inquiryAlertText(title,link,escapeDiscord),allowed_mentions:{parse:[]},flags:4}):Promise.resolve<ChannelResult>('skipped'),
 ]);
 return {email,slack,discord};
}
