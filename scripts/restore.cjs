// npm run restore -- <backup folder> --yes
// Only while the server is stopped: refuses when the health URL answers (MOTION_STUDIO_URL, default http://127.0.0.1:$PORT or 3000).
// The current .local-data is backed up first (label pre-restore; pruning waits until the copy is done). Running renders in the backup are marked failed.
const fs=require('fs'),path=require('path');
const {createBackup,copyTree,listBackups,paths,prune}=require('./backup.cjs');
function fail(message){console.error('복원 중단: '+message);process.exit(1);}
async function serverAnswers(){
 const base=(process.env.MOTION_STUDIO_URL||`http://127.0.0.1:${process.env.PORT||3000}`).replace(/\/+$/,'');
 try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)});return true;}catch{return false;}
}
function resolveBackup(input,backups){
 const direct=path.resolve(process.cwd(),input),named=path.join(backups,input);
 const target=fs.existsSync(direct)?direct:named;
 if(!fs.existsSync(path.join(target,'manifest.json')))fail('백업 폴더(manifest.json 포함)를 찾지 못했습니다. 목록: '+(listBackups(backups).join(', ')||'없음'));
 return target;
}
function failRunningRenders(data){
 const directory=path.join(data,'renders');let changed=0;
 for(const name of fs.existsSync(directory)?fs.readdirSync(directory):[]){
  if(!name.endsWith('.json'))continue;const file=path.join(directory,name);
  try{const job=JSON.parse(fs.readFileSync(file,'utf8'));if(['queued','processing'].includes(job.status)){job.status='failed';job.error='백업 복원으로 렌더가 중단되었습니다. 다시 시도해 주세요.';job.updatedAt=new Date().toISOString();delete job.pid;fs.writeFileSync(file,JSON.stringify(job,null,2));changed++;}}catch{}
 }
 return changed;
}
(async()=>{
 const args=process.argv.slice(2),input=args.find(value=>!value.startsWith('--'));
 if(!input)fail('사용법: npm run restore -- <백업 폴더> --yes');
 const {data,backups}=paths(),source=resolveBackup(input,backups);
 if(path.resolve(source).startsWith(data+path.sep))fail('.local-data 안의 폴더는 복원할 수 없습니다.');
 if(!args.includes('--yes'))fail('서버를 멈춘 뒤 --yes를 붙여 다시 실행하세요. 현재 데이터는 복원 전에 자동 백업됩니다.');
 if(await serverAnswers())fail('서버가 아직 응답합니다. 서버를 멈춘 뒤 다시 실행하세요.');
 let safety='';if(fs.existsSync(data))safety=createBackup('pre-restore',{skipPrune:true}).name;
 fs.mkdirSync(data,{recursive:true});
 for(const name of fs.readdirSync(data))fs.rmSync(path.join(data,name),{recursive:true,force:true});
 copyTree(source,data);fs.rmSync(path.join(data,'manifest.json'),{force:true});
 const failed=failRunningRenders(data);prune(backups);
 console.log(`복원 완료: ${path.basename(source)}${safety?` (복원 전 데이터: ${safety})`:''}${failed?` · 진행 중이던 렌더 ${failed}개를 실패로 표시`:''}`);
})().catch(error=>fail(error.message));
