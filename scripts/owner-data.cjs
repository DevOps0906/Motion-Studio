// Shared by migrate:owner and account:delete (server stopped). Every write is one file at a time via temp file + rename,
// and only touches records by their ownerId, so an interrupted run is finished by running it again.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{DatabaseSync}=require('node:sqlite');
const OWNER_DIRS=['projects','media','websites','blog-skins','renders','models'];
function readRecord(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function writeAtomic(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,file);}
function records(data){
 const found=[];
 for(const dir of OWNER_DIRS){
  const directory=path.join(data,dir);
  for(const name of fs.existsSync(directory)?fs.readdirSync(directory):[]){
   if(!name.endsWith('.json'))continue;
   const file=path.join(directory,name),record=readRecord(file);
   if(record&&typeof record==='object'&&!Array.isArray(record))found.push({dir,file,record});
  }
 }
 return found;
}
const hasOwner=record=>typeof record.ownerId==='string'&&record.ownerId.length>0;
// from=null: records without an owner. from=<id>: records of that owner. Returns counts per folder.
function reassign(data,{from=null,to,dryRun=false}){
 const counts={};
 for(const {dir,file,record} of records(data)){
  if(from===null?hasOwner(record):record.ownerId!==from)continue;
  counts[dir]=(counts[dir]||0)+1;
  if(!dryRun)writeAtomic(file,{...record,ownerId:to});
 }
 return counts;
}
function countUnowned(data){return records(data).filter(({record})=>!hasOwner(record)).length;}
function openInquiries(data){
 const file=path.join(data,'inquiries.sqlite');
 if(!fs.existsSync(file))return null;
 const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=5000');
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inquiries'").get()){db.close();return null;}
 return db;
}
// Inquiries live in SQLite (owner_id column, added here when a database from before this change has none).
function reassignInquiries(data,{from=null,to,dryRun=false}){
 const db=openInquiries(data);if(!db)return 0;
 try{
  const hasColumn=db.prepare('PRAGMA table_info(inquiries)').all().some(column=>column.name==='owner_id');
  if(!hasColumn){
   const total=Number(db.prepare('SELECT COUNT(*) AS count FROM inquiries').get().count);
   if(dryRun||from!==null)return from===null?total:0;
   db.exec('ALTER TABLE inquiries ADD COLUMN owner_id TEXT');
  }
  const where=from===null?'owner_id IS NULL':'owner_id = ?',args=from===null?[]:[from];
  const count=Number(db.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE ${where}`).get(...args).count);
  if(!dryRun&&count)db.prepare(`UPDATE inquiries SET owner_id = ? WHERE ${where}`).run(to,...args);
  return count;
 }finally{db.close();}
}
function countUnownedInquiries(data){
 const db=openInquiries(data);if(!db)return 0;
 try{
  if(!db.prepare('PRAGMA table_info(inquiries)').all().some(column=>column.name==='owner_id'))return Number(db.prepare('SELECT COUNT(*) AS count FROM inquiries').get().count);
  return Number(db.prepare('SELECT COUNT(*) AS count FROM inquiries WHERE owner_id IS NULL').get().count);
 }finally{db.close();}
}
const total=counts=>Object.values(counts).reduce((sum,value)=>sum+value,0);
const describe=counts=>Object.entries(counts).map(([dir,count])=>`${dir} ${count}`).join(', ')||'없음';
module.exports={OWNER_DIRS,reassign,reassignInquiries,countUnowned,countUnownedInquiries,total,describe};
