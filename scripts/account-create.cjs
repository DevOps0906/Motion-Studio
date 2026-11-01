// Operator account creation on the server only: npm run account:create -- <email> [--name 표시이름] [--reset]
// Password is typed interactively (hidden). Without a TTY, the first two stdin lines are read (password, confirmation).
const path=require('path'),readline=require('readline');
const store=require(path.join(__dirname,'..','lib','account-store.ts'));
function fail(message){console.error(message);process.exit(1);}
function parse(argv){
 const options={email:'',name:'',reset:false};
 for(let i=0;i<argv.length;i++){const value=argv[i];if(value==='--reset')options.reset=true;else if(value==='--name')options.name=String(argv[++i]||'').trim();else if(!value.startsWith('--')&&!options.email)options.email=value;else fail(`알 수 없는 인자: ${value}`);}
 return options;
}
async function readPasswords(){
 if(!process.stdin.isTTY){
  const lines=[];const rl=readline.createInterface({input:process.stdin,terminal:false});
  for await(const line of rl){lines.push(line);if(lines.length===2)break;}
  rl.close();return lines;
 }
 const ask=question=>new Promise(resolve=>{
  const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
  rl._writeToOutput=text=>{if(text.includes(question))process.stdout.write(question);};
  rl.question(question,answer=>{rl.close();process.stdout.write('\n');resolve(answer);});
 });
 return [await ask('비밀번호(8~200자): '),await ask('비밀번호 확인: ')];
}
(async()=>{
 const options=parse(process.argv.slice(2));const email=store.normalizeEmail(options.email);
 if(!email)fail('사용법: npm run account:create -- <email> [--name 표시이름] [--reset]');
 if(options.name.length>80)fail('표시 이름은 1~80자로 입력해 주세요.');
 const existing=await store.readAccount(email);
 if(existing&&!options.reset)fail('이미 있는 계정입니다. 비밀번호를 바꾸려면 --reset을 붙여 다시 실행하세요.');
 if(!existing&&options.reset)fail('없는 계정은 재설정할 수 없습니다. --reset 없이 실행하세요.');
 const [password,confirm]=await readPasswords();
 if(password!==confirm)fail('두 비밀번호가 다릅니다.');
 if(!store.validCredentials(email,password||''))fail('이메일 형식과 8~200자 비밀번호를 확인해 주세요.');
 const name=options.name||existing?.name||email.split('@')[0].slice(0,80);
 try{await store.writeAccount({name,email,password},Boolean(existing));}catch{fail('계정을 저장하지 못했습니다. 이미 있는 계정인지 확인하세요.');}
 if(existing){const removed=await store.revokeSessions(email);console.log(`비밀번호를 재설정했습니다. 기존 로그인 ${removed}개를 종료했습니다.`);}
 else console.log('운영자 계정을 만들었습니다. 운영자 권한은 REQUIREMENTS_ADMIN_EMAILS에 이 이메일을 넣어야 적용됩니다.');
})().catch(()=>fail('계정을 만들지 못했습니다.'));
