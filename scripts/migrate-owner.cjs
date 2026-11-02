// npm run migrate:owner -- --owner <operator email> [--dry-run]
// Run only while the server is stopped (refuses when the health URL answers). Order: backup -> stop -> deploy code -> --dry-run -> run -> start.
// 1) gives every account an id  2) puts every item without ownerId (projects, media, websites, blog skins, renders, models, inquiries) under the operator
// 3) revokes all sessions so everyone logs in again with an id. Re-running only fills what is still missing (idempotent).
const path=require('path'),crypto=require('crypto');
const store=require(path.join(__dirname,'..','lib','account-store.ts'));
const {paths,serverAnswers}=require('./backup.cjs');
const owners=require('./owner-data.cjs');
function fail(message){console.error('이전 중단: '+message);process.exit(1);}
function parse(argv){
 const options={owner:'',dryRun:false};
 for(let i=0;i<argv.length;i++){const value=argv[i];if(value==='--dry-run')options.dryRun=true;else if(value==='--owner')options.owner=String(argv[++i]||'');else fail(`알 수 없는 인자: ${value}`);}
 return options;
}
(async()=>{
 const options=parse(process.argv.slice(2)),email=store.normalizeEmail(options.owner),{data}=paths();
 if(!email)fail('사용법: npm run migrate:owner -- --owner <운영자 이메일> [--dry-run]');
 if(!store.isAdminEmail(email))fail('--owner는 REQUIREMENTS_ADMIN_EMAILS에 들어 있는 운영자 이메일이어야 합니다.');
 if(await serverAnswers())fail('서버가 아직 응답합니다. 서버를 멈춘 뒤 다시 실행하세요.');
 const accounts=await store.listAccounts(),operator=accounts.find(account=>account.email===email);
 if(!operator)fail('운영자 계정을 찾지 못했습니다. 먼저 npm run account:create로 만드세요.');
 let issued=0;
 for(const account of accounts)if(!account.id){issued++;if(!options.dryRun){account.id=crypto.randomUUID();await store.saveAccountRecord(account);}}
 const ownerId=operator.id||'(dry-run)';
 const moved=owners.reassign(data,{to:ownerId,dryRun:options.dryRun});
 const inquiries=owners.reassignInquiries(data,{to:ownerId,dryRun:options.dryRun});
 const revoked=options.dryRun?0:await store.revokeAllSessions();
 const label=options.dryRun?'[dry-run: 변경 없음] ':'';
 console.log(`${label}계정 id 발급 ${issued}개 · 소유자 지정: ${owners.describe(moved)} · 문의 ${inquiries}건 · 로그인 ${options.dryRun?'(폐기 안 함)':revoked+'개 폐기'}`);
 if(!options.dryRun){
  const left=owners.countUnowned(data)+owners.countUnownedInquiries(data);
  if(left)fail(`소유자 없는 자료가 ${left}건 남았습니다. 다시 실행하세요.`);
  console.log('검증: 소유자 없는 자료 0건');
 }
})().catch(error=>fail(error.message));
