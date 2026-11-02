// npm run backup: copy .local-data into backups/<time>/ (folder, mode 0700).
// SQLite files are copied online with VACUUM INTO; -wal/-shm, render.lock and health probes are skipped.
// Retention: newest BACKUP_KEEP folders (default 14) within BACKUP_MAX_BYTES total (default 5GB), whichever limit hits first.
const fs=require('fs'),path=require('path'),{DatabaseSync}=require('node:sqlite');
const SKIP=name=>name==='render.lock'||/-(wal|shm|journal)$/.test(name)||name.startsWith('.health-');
const paths=()=>({data:path.resolve(process.cwd(),'.local-data'),backups:path.resolve(process.cwd(),process.env.BACKUP_DIR||'backups')});
const stamp=(date=new Date())=>date.toISOString().replace(/[-:]/g,'').replace('T','-').replace(/\..*$/,'');
const BACKUP_NAME=/^\d{8}-\d{6}(-[a-z0-9-]+)?$/;
function size(target){const stat=fs.lstatSync(target);if(!stat.isDirectory())return stat.size;return fs.readdirSync(target).reduce((sum,name)=>sum+size(path.join(target,name)),0);}
function copyTree(source,target){
 fs.mkdirSync(target,{recursive:true,mode:0o700});
 for(const entry of fs.readdirSync(source,{withFileTypes:true})){
  if(SKIP(entry.name))continue;const from=path.join(source,entry.name),to=path.join(target,entry.name);
  if(entry.isDirectory())copyTree(from,to);
  else if(entry.isFile()&&entry.name.endsWith('.sqlite')){const db=new DatabaseSync(from);try{db.exec('PRAGMA busy_timeout=5000');db.exec(`VACUUM INTO '${to.replace(/'/g,"''")}'`);}finally{db.close();}}
  else if(entry.isFile())fs.copyFileSync(from,to);
 }
}
function listBackups(dir){
 return fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&BACKUP_NAME.test(entry.name)&&fs.existsSync(path.join(dir,entry.name,'manifest.json'))).map(entry=>entry.name).sort().reverse():[];
}
function prune(dir,keep=Number(process.env.BACKUP_KEEP||14),maxBytes=Number(process.env.BACKUP_MAX_BYTES||5*1024**3)){
 let total=0;const removed=[];
 listBackups(dir).forEach((name,index)=>{
  const target=path.join(dir,name);total+=size(target);
  // The newest backup is always kept, even when it alone exceeds the size cap.
  if(index>0&&(index>=keep||total>maxBytes)){fs.rmSync(target,{recursive:true,force:true});removed.push(name);}
 });
 return removed;
}
function createBackup(label='',{skipPrune=false}={}){
 const {data,backups}=paths();
 if(!fs.existsSync(data))throw Error('.local-data 폴더가 없습니다.');
 fs.mkdirSync(backups,{recursive:true,mode:0o700});try{fs.chmodSync(backups,0o700);}catch{}
 let name=stamp()+(label?'-'+label:'');for(let i=2;fs.existsSync(path.join(backups,name));i++)name=stamp()+(label?'-'+label:'')+'-'+i;
 const partial=path.join(backups,'.partial-'+name),final=path.join(backups,name);
 try{
  copyTree(data,partial);
  fs.writeFileSync(path.join(partial,'manifest.json'),JSON.stringify({format:'motion-studio-backup-v1',createdAt:new Date().toISOString()}),{mode:0o600});
  fs.renameSync(partial,final);
 }catch(error){fs.rmSync(partial,{recursive:true,force:true});throw error;}
 return {name,path:final,removed:skipPrune?[]:prune(backups)};
}
// True while the web server answers its health URL (MOTION_STUDIO_URL, default http://127.0.0.1:$PORT or 3000). Maintenance scripts refuse to run then.
async function serverAnswers(){
 const base=(process.env.MOTION_STUDIO_URL||`http://127.0.0.1:${process.env.PORT||3000}`).replace(/\/+$/,'');
 try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)});return true;}catch{return false;}
}
module.exports={createBackup,prune,listBackups,copyTree,SKIP,paths,serverAnswers};
if(require.main===module){
 try{const result=createBackup();console.log(`백업 완료: ${path.relative(process.cwd(),result.path)}${result.removed.length?` (오래된 백업 ${result.removed.length}개 삭제)`:''}`);}
 catch(error){console.error('백업 실패: '+error.message);process.exit(1);}
}
