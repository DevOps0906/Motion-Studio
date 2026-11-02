// npm run account:delete -- <email> --yes [--to <operator email>]
// Server stopped only. Order: end the account's sessions -> hand its items and inquiries to the operator -> delete the account file (last).
// If it stops half way the account file is still there, so running it again finishes the job. The operator account itself is never deleted.
const path=require('path');
const store=require(path.join(__dirname,'..','lib','account-store.ts'));
const {paths,serverAnswers}=require('./backup.cjs');
const owners=require('./owner-data.cjs');
function fail(message){console.error('삭제 중단: '+message);process.exit(1);}
function parse(argv){
 const options={email:'',to:'',yes:false};
 for(let i=0;i<argv.length;i++){const value=argv[i];if(value==='--yes')options.yes=true;else if(value==='--to')options.to=String(argv[++i]||'');else if(!value.startsWith('--')&&!options.email)options.email=value;else fail(`알 수 없는 인자: ${value}`);}
 return options;
}
(async()=>{
 const options=parse(process.argv.slice(2)),email=store.normalizeEmail(options.email),{data}=paths();
 if(!email)fail('사용법: npm run account:delete -- <email> --yes [--to <운영자 이메일>]');
 if(store.isAdminEmail(email))fail('운영자 계정은 삭제할 수 없습니다.');
 if(!options.yes)fail('서버를 멈춘 뒤 --yes를 붙여 다시 실행하세요. 계정의 자료는 운영자에게 이전됩니다.');
 if(await serverAnswers())fail('서버가 아직 응답합니다. 서버를 멈춘 뒤 다시 실행하세요.');
 const victim=await store.readAccount(email);
 if(!victim)fail('없는 계정입니다.');
 if(!victim.id)fail('계정 id가 없습니다. 먼저 npm run migrate:owner를 실행하세요.');
 const admins=(process.env.REQUIREMENTS_ADMIN_EMAILS||'').split(',').map(value=>store.normalizeEmail(value)).filter(Boolean);
 const targetEmail=store.normalizeEmail(options.to)||admins[0]||'';
 if(!targetEmail||!store.isAdminEmail(targetEmail))fail('자료를 받을 운영자 이메일을 --to로 지정하세요(REQUIREMENTS_ADMIN_EMAILS에 있어야 합니다).');
 const target=await store.readAccount(targetEmail);
 if(!target||!target.id)fail('자료를 받을 운영자 계정을 찾지 못했거나 id가 없습니다.');
 const revoked=await store.revokeSessions(email);
 const moved=owners.reassign(data,{from:victim.id,to:target.id});
 const inquiries=owners.reassignInquiries(data,{from:victim.id,to:target.id});
 await store.deleteAccountFile(email);
 console.log(`계정을 삭제했습니다. 로그인 ${revoked}개 종료 · 운영자에게 이전: ${owners.describe(moved)} · 문의 ${inquiries}건`);
})().catch(error=>fail(error.message));
