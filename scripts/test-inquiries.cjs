// task-003: website inquiry form, API, alerts and operator access. No real network: fetch is always a stub.
const fs=require('fs'),os=require('os'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),path=require('path');
const ROOT=process.cwd();
function world({stubs={},env={},fetch=async()=>{throw Error('network disabled in tests');},cwd}={}){
 const cache=new Map(),sandboxProcess={env,cwd:()=>cwd||ROOT};
 function load(file){
  const key=path.resolve(file);if(cache.has(key))return cache.get(key).exports;
  const module={exports:{}};cache.set(key,module);
  const code=ts.transpileModule(fs.readFileSync(key,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,process:sandboxProcess,fetch,Date,URL,TextEncoder,TextDecoder,AbortSignal,Response,Request,JSON,console,
   require:id=>{
    if(id==='server-only')return {};
    if(id.startsWith('node:'))return require(id);
    const target=id.startsWith('.')?path.resolve(path.dirname(key),id):id;
    for(const [name,value] of Object.entries(stubs))if(target===path.resolve(ROOT,name)||target===name)return value;
    return load(target+'.ts');
   }});
  return module.exports;
 }
 return load;
}
const UUID=()=>require('crypto').randomUUID();
const valid=(overrides={})=>({websiteId:'site-1',submissionKey:UUID(),name:'홍길동',contact:'guest@example.com',message:'견적 문의드립니다.',consent:true,website:'',...overrides});
(async()=>{
 // 1. Input validation, limits, consent, honeypot flag
 const {validateInquiry,INQUIRY_LIMITS,createRateLimiter}=world()('lib/inquiry.ts');
 assert.equal(validateInquiry(valid()).name,'홍길동');assert.equal(validateInquiry(valid({contact:'010-1234-5678'})).contact,'010-1234-5678');
 for(const bad of [{name:''},{name:'가'.repeat(51)},{contact:'x'.repeat(101)},{contact:'아무거나'},{message:' '},{message:'a'.repeat(2001)},{submissionKey:'abc'},{websiteId:'../x'}])assert.throws(()=>validateInquiry(valid(bad)),undefined,JSON.stringify(bad).slice(0,40));
 assert.equal(validateInquiry(valid({name:'가'.repeat(50),message:'a'.repeat(2000)})).message.length,2000);
 assert.throws(()=>validateInquiry(valid({consent:false})),/동의/);assert.throws(()=>validateInquiry(valid({consent:'true'})),/동의/);
 assert.equal(validateInquiry(valid({website:'http://spam'})).honeypot,true);assert.equal(INQUIRY_LIMITS.body,16384);
 const limiter=createRateLimiter(2,1000);limiter.record('a',0);limiter.record('a',10);assert.equal(limiter.allows('a',20),false);assert.equal(limiter.allows('b',20),true);assert.equal(limiter.allows('a',1011),true);
 console.log('PASS: inquiry validation limits, required consent, honeypot flag, rate limiter window');

 // 2. Webhook host checks, escaping, alert body without personal data, global hourly cap
 const notify=()=>world()('lib/server/inquiry-notify.ts');
 const {slackWebhookUrl,discordWebhookUrl,escapeSlack,escapeDiscord,inquiryAdminLink,sendInquiryAlerts}=notify();
 assert.ok(slackWebhookUrl('https://hooks.slack.com/services/T/B/x'));
 for(const url of ['http://hooks.slack.com/services/x','https://hooks.slack.com.evil.com/x','https://evil.com/hooks.slack.com','https://user:pw@hooks.slack.com/x','https://hooks.slack.com:8443/x','not a url',undefined])assert.equal(slackWebhookUrl(url),'',String(url));
 assert.ok(discordWebhookUrl('https://discord.com/api/webhooks/1/abc'));assert.ok(discordWebhookUrl('https://discordapp.com/api/webhooks/1/abc'));
 for(const url of ['https://discord.com/channels/1','http://discord.com/api/webhooks/1/a','https://evil.discord.com.example/api/webhooks/1','https://discord.gg/api/webhooks/1'])assert.equal(discordWebhookUrl(url),'',url);
 assert.equal(escapeSlack('A & <b> <!channel>'),'A &amp; &lt;b&gt; &lt;!channel&gt;');
 assert.equal(escapeDiscord('**굵게** @everyone [링크](x) `c`'),'\\*\\*굵게\\*\\* \\@everyone \\[링크\\]\\(x\\) \\`c\\`');
 assert.equal(inquiryAdminLink('https://studio.example.com/app'),'https://studio.example.com/websites/inquiries');assert.equal(inquiryAdminLink('http://localhost:3000'),'http://localhost:3000/websites/inquiries');
 for(const base of ['http://studio.example.com','javascript:alert(1)','',undefined])assert.equal(inquiryAdminLink(base),'');
 const calls=[],okFetch=async(url,init)=>{calls.push({url,init});return {ok:true};};
 const fullEnv={RESEND_API_KEY:'re_test_secret',INQUIRY_EMAIL_FROM:'alerts@example.com',INQUIRY_EMAIL_TO:'a@example.com, b@example.com',SLACK_WEBHOOK_URL:'https://hooks.slack.com/services/T/B/x',DISCORD_WEBHOOK_URL:'https://discord.com/api/webhooks/1/abc',APP_BASE_URL:'https://studio.example.com'};
 assert.deepEqual({...await sendInquiryAlerts('<b>사이트</b> & *브랜드*',fullEnv,okFetch,0)},{email:'sent',slack:'sent',discord:'sent'});
 assert.equal(calls.length,3);
 for(const call of calls){const body=String(call.init.body);for(const secret of ['홍길동','guest@example.com','견적 문의'])assert.ok(!body.includes(secret));assert.ok(body.includes('새 문의 1건'));assert.ok(body.includes('https://studio.example.com/websites/inquiries'));assert.ok(call.init.signal);}
 const [email,slack,discord]=['api.resend.com','hooks.slack.com','discord.com'].map(host=>calls.find(call=>new URL(call.url).hostname===host));
 assert.equal(email.init.headers.Authorization,'Bearer re_test_secret');assert.deepEqual(JSON.parse(email.init.body).to,['a@example.com','b@example.com']);assert.equal(typeof JSON.parse(email.init.body).text,'string');
 assert.ok(JSON.parse(slack.init.body).text.includes('&lt;b&gt;사이트&lt;/b&gt; &amp;'));assert.equal(JSON.parse(slack.init.body).unfurl_links,false);assert.equal(JSON.parse(slack.init.body).unfurl_media,false);
 const urlTitle=[];await notify().sendInquiryAlerts('https://evil.example.com/x 이벤트 www.bad.co.kr',fullEnv,async(url,init)=>{urlTitle.push(JSON.parse(init.body));return {ok:true};},0);
 for(const body of urlTitle){const text=body.text||body.content;assert.ok(!/evil\.example|bad\.co|https:\/\/evil/.test(text),text);assert.ok(text.includes('https://studio.example.com/websites/inquiries'),text);}
 assert.ok(urlTitle.find(body=>body.unfurl_links===false).text.includes('https[:]//evil[.]example[.]com/x'));assert.ok(urlTitle.find(body=>body.subject).text.includes('www[.]bad[.]co[.]kr'));
 const discordBody=JSON.parse(discord.init.body);assert.deepEqual(discordBody.allowed_mentions,{parse:[]});assert.equal(discordBody.flags,4);assert.ok(discordBody.content.includes('\\*브랜드\\*'));
 const noLink=[];await sendInquiryAlerts('사이트',{...fullEnv,APP_BASE_URL:'http://public.example.com'},async(url,init)=>{noLink.push(String(init.body));return {ok:true};},0);
 assert.ok(noLink.every(body=>!body.includes('example.com/websites')));
 assert.deepEqual({...await sendInquiryAlerts('사이트',{SLACK_WEBHOOK_URL:'https://evil.com/x',DISCORD_WEBHOOK_URL:'https://discord.com/channels/1'},okFetch,0)},{email:'skipped',slack:'skipped',discord:'skipped'});
 const failing=await sendInquiryAlerts('사이트',fullEnv,async(url)=>{if(url.includes('slack'))throw Error('timeout');return {ok:url.includes('resend')};},0);
 assert.deepEqual({...failing},{email:'sent',slack:'failed',discord:'failed'});
 const capped=notify().sendInquiryAlerts,capCalls=[];let last;
 for(let i=0;i<31;i++)last=await capped('사이트',{SLACK_WEBHOOK_URL:fullEnv.SLACK_WEBHOOK_URL},async(url)=>{capCalls.push(url);return {ok:true};},1000+i);
 assert.equal(capCalls.length,30);assert.equal(last.slack,'skipped');
 assert.equal((await capped('사이트',{SLACK_WEBHOOK_URL:fullEnv.SLACK_WEBHOOK_URL},async()=>({ok:true}),1000+60*60_000+1)).slack,'sent');
 console.log('PASS: webhook host checks, Slack/Discord escaping, alert body without personal data, admin link rule, hourly cap 30');

 // 3. Storage flow: form-off sites, honeypot, duplicate keys, rate limits, alert failure, operator-only access
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'inquiries-test-'));
 const sites={'site-1':{title:'사이트 하나',inquiryForm:true},'site-off':{title:'폼 꺼짐',inquiryForm:false},'site-old':{title:'옛 데이터'}};
 for(let i=2;i<=8;i++)sites['site-'+i]={title:'사이트 '+i,inquiryForm:true};
 let allowed=false;const queued=[];
 const stubs={
  'lib/server/websites':{getWebsite:async id=>{if(!sites[id])throw Object.assign(Error('ENOENT /secret/path'),{code:'ENOENT'});return {id,...sites[id]};}},
  'lib/server/website-requirements':{canReadRequirements:async()=>allowed},
  'next/server':{after:task=>queued.push(task)},
 };
 const load=world({stubs,cwd:tmp,env:{SLACK_WEBHOOK_URL:'https://hooks.slack.com/services/T/B/x'},fetch:async()=>{throw Error('webhook down');}});
 const {submitInquiry,listInquiries,unreadInquiryCount}=load('lib/server/inquiries.ts');
 const api=load('app/api/inquiries/route.ts'),item=load('app/api/inquiries/[id]/route.ts'),unread=load('app/api/inquiries/unread/route.ts');
 const post=body=>api.POST(new Request('http://localhost/api/inquiries',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}));
 let response=await post(valid());assert.equal(response.status,201);assert.deepEqual(await response.json(),{ok:true});
 assert.equal(queued.length,1);await queued[0]();
 let rows=listInquiries();assert.equal(rows.length,1);assert.deepEqual({...rows[0].notify},{email:'skipped',slack:'failed',discord:'skipped'});assert.equal(rows[0].readAt,null);
 response=await post(valid({websiteId:'site-off'}));assert.equal(response.status,404);assert.ok(!(await response.text()).includes('ENOENT'));
 assert.equal((await post(valid({websiteId:'site-old'}))).status,404);
 response=await post(valid({websiteId:'missing'}));assert.equal(response.status,404);assert.ok(!(await response.text()).includes('secret'));
 assert.equal((await post(valid({consent:false}))).status,400);
 assert.equal((await post('{broken')).status,400);
 assert.equal((await post(JSON.stringify(valid({message:'가'.repeat(1990)})).padEnd(16*1024+1,' '))).status,413);
 response=await post(valid({website:'http://bot.example'}));assert.equal(response.status,201);assert.deepEqual(await response.json(),{ok:true});assert.equal(listInquiries().length,1);
 const key=UUID();assert.ok((await submitInquiry(valid({websiteId:'site-2',submissionKey:key}))).alert);
 assert.equal((await submitInquiry(valid({websiteId:'site-2',submissionKey:key}))).alert,null);assert.equal(listInquiries().length,2);
 for(let i=0;i<4;i++)await submitInquiry(valid({websiteId:'site-2'}));
 await assert.rejects(submitInquiry(valid({websiteId:'site-2'})),error=>error.status===429);
 response=await post(valid({websiteId:'site-2'}));assert.equal(response.status,429);
 assert.equal((await submitInquiry(valid({websiteId:'site-2',submissionKey:key}))).alert,null);
 // Global: 30 per 10 minutes across all sites (6 stored so far).
 for(const id of ['site-3','site-4','site-5','site-6'])for(let i=0;i<5;i++)await submitInquiry(valid({websiteId:id}));
 for(let i=0;i<4;i++)await submitInquiry(valid({websiteId:'site-7'}));
 assert.equal(listInquiries().length,30);
 await assert.rejects(submitInquiry(valid({websiteId:'site-8'})),error=>error.status===429);
 // Operators only
 allowed=false;
 assert.equal((await api.GET(new Request('http://localhost/api/inquiries'))).status,403);
 assert.equal((await unread.GET(new Request('http://localhost/api/inquiries/unread'))).status,403);
 const target=listInquiries()[0].id,ctx={params:Promise.resolve({id:target})};
 assert.equal((await item.PATCH(new Request('http://localhost/api/inquiries/'+target,{method:'PATCH'}),ctx)).status,403);
 assert.equal(listInquiries().find(row=>row.id===target).readAt,null);
 allowed=true;
 const listed=await (await api.GET(new Request('http://localhost/api/inquiries'))).json();assert.equal(listed.length,30);assert.equal(listed[0].name,'홍길동');
 assert.equal((await (await unread.GET(new Request('http://localhost/api/inquiries/unread'))).json()).count,30);
 assert.equal((await item.PATCH(new Request('http://localhost/x',{method:'PATCH'}),ctx)).status,200);
 assert.equal(unreadInquiryCount(),29);assert.ok(listInquiries().find(row=>row.id===target).readAt);
 assert.equal((await item.PATCH(new Request('http://localhost/x',{method:'PATCH'}),{params:Promise.resolve({id:UUID()})})).status,404);
 console.log('PASS: form-off/old sites rejected, honeypot not stored, duplicate keys, site/global rate limits, alert failure keeps inquiry, operator-only list/read/badge');
 // 3b. Streaming body limit, stale pending alerts, 90-day purge with an injected clock
 {
  const tmp2=fs.mkdtempSync(path.join(os.tmpdir(),'inquiries-test-'));const queued2=[];
  const load2=world({stubs:{...stubs,'next/server':{after:task=>queued2.push(task)}},cwd:tmp2});
  const store=load2('lib/server/inquiries.ts'),api2=load2('app/api/inquiries/route.ts');
  let pulls=0;const big=new TextEncoder().encode('x'.repeat(4096));
  const endless=new ReadableStream({pull(controller){pulls++;controller.enqueue(big);}});
  let res=await api2.POST(new Request('http://localhost/api/inquiries',{method:'POST',body:endless,duplex:'half'}));
  assert.equal(res.status,413);assert.ok(pulls<=6,'stopped reading after 16KB, pulls='+pulls);
  res=await api2.POST({headers:new Headers({'content-length':String(16*1024+1)}),body:null});assert.equal(res.status,413);
  const okBody=new TextEncoder().encode(JSON.stringify(valid({websiteId:'site-3'})));
  res=await api2.POST(new Request('http://localhost/api/inquiries',{method:'POST',body:new ReadableStream({start(c){c.enqueue(okBody.slice(0,20));c.enqueue(okBody.slice(20));c.close();}}),duplex:'half'}));
  assert.equal(res.status,201);
  const now=Date.now();
  await store.submitInquiry(valid({websiteId:'site-4'}),now-11*60_000);
  const recent=store.listInquiries(now);assert.equal(recent.length,2);
  assert.deepEqual({...recent.find(row=>row.websiteId==='site-4').notify},{email:'unknown',slack:'unknown',discord:'unknown'});
  assert.equal(recent.find(row=>row.websiteId==='site-3').notify.email,'pending');
  await store.submitInquiry(valid({websiteId:'site-5'}),now-91*86400000);
  assert.equal(store.listInquiries(now).length,2);assert.ok(!store.listInquiries(now).some(row=>row.websiteId==='site-5'));
  await store.submitInquiry(valid({websiteId:'site-6'}),now-89*86400000);assert.equal(store.listInquiries(now).length,3);
  try{fs.rmSync(tmp2,{recursive:true,force:true});}catch{}
 }
 console.log('PASS: streamed 16KB body cutoff, Content-Length 413, stale pending shown as unknown, 90-day purge with injected clock');

 // 4. canReadRequirements denies non-operators (shared rule for API, page and badge)
 let account=null;
 const access=world({stubs:{'lib/server/accounts':{currentAccount:async()=>account}},env:{REQUIREMENTS_ADMIN_EMAILS:'owner@example.com'}})('lib/server/website-requirements.ts');
 assert.equal(await access.canReadRequirements(new Request('http://localhost/')),false);
 account={name:'손님',email:'guest@example.com'};assert.equal(await access.canReadRequirements(new Request('http://localhost/')),false);
 account={name:'운영자',email:'Owner@example.com'};assert.equal(await access.canReadRequirements(new Request('https://studio.example.com/')),true);
 console.log('PASS: operator rule rejects anonymous and non-admin accounts');

 // 5. Old website data without inquiryForm stays compatible (defaults to false)
 const {EMPTY_WEBSITE,validateWebsiteBrief}=world()('lib/website.ts');
 const brief={...EMPTY_WEBSITE,title:'옛 사이트',brand:'OLD',headline:'헤드라인',description:'설명'};delete brief.inquiryForm;
 assert.equal(EMPTY_WEBSITE.inquiryForm,false);assert.equal(validateWebsiteBrief(brief).inquiryForm,false);
 assert.equal(validateWebsiteBrief({...brief,inquiryForm:true}).inquiryForm,true);assert.throws(()=>validateWebsiteBrief({...brief,inquiryForm:'yes'}),/문의 폼/);
 console.log('PASS: inquiryForm defaults to false for old website data');
 try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
})().catch(error=>{console.error(error);process.exit(1);});
