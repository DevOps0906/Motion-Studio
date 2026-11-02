// npm run models:revalidate [-- --dry-run]
// Re-checks every stored GLB with the upload validator (lib/glb-validate.ts). A failing model gets `invalid: <reason>` in its JSON
// (views and later features refuse it); a model that passes again loses the mark. Run only while the server is stopped. Re-running is safe.
const fs=require('fs'),path=require('path');
const {validateGlb}=require(path.join(__dirname,'..','lib','glb-validate.ts'));
const {paths,serverAnswers}=require('./backup.cjs');
function fail(message){console.error('재검증 중단: '+message);process.exit(1);}
(async()=>{
 const args=process.argv.slice(2),dryRun=args.includes('--dry-run');
 const unknown=args.find(arg=>arg!=='--dry-run');if(unknown)fail(`알 수 없는 인자: ${unknown}`);
 if(await serverAnswers())fail('서버가 아직 응답합니다. 서버를 멈춘 뒤 다시 실행하세요.');
 const dir=path.join(paths().data,'models');
 const counts={checked:0,valid:0,invalid:0,missing:0,changed:0};
 for(const file of fs.existsSync(dir)?fs.readdirSync(dir).filter(name=>name.endsWith('.json')).sort():[]){
  const jsonFile=path.join(dir,file),glbFile=jsonFile.replace(/\.json$/,'.glb');
  let record;try{record=JSON.parse(fs.readFileSync(jsonFile,'utf8'));}catch{}
  if(!record||typeof record!=='object'||Array.isArray(record)){console.log(`건너뜀 ${file}: 모델 JSON이 객체가 아닙니다.`);continue;}
  counts.checked++;
  let reason='';
  if(!fs.existsSync(glbFile)){counts.missing++;reason='GLB 파일이 없습니다.';}
  else{try{validateGlb(fs.readFileSync(glbFile));}catch(error){reason=error.message;}}
  if(reason)counts.invalid++;else counts.valid++;
  if((record.invalid||'')===reason)continue;
  counts.changed++;
  console.log(`${dryRun?'[dry-run] ':''}${reason?'invalid 표시':'invalid 해제'} ${record.id||file}: ${reason||'통과'}`);
  if(dryRun)continue;
  if(reason)record.invalid=reason;else delete record.invalid;
  const temp=jsonFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(record,null,2));fs.renameSync(temp,jsonFile);
 }
 console.log(`${dryRun?'[dry-run] ':''}검사 ${counts.checked}건 · 통과 ${counts.valid} · invalid ${counts.invalid} (파일 없음 ${counts.missing}) · 표시 변경 ${counts.changed}`);
})().catch(error=>fail(error.message));
