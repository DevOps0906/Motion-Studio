import {SPECIALIST_SOLUTIONS} from '../website-service-catalog';
import 'server-only';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {currentAccount} from './accounts';
import {REQUIREMENT_FEATURES,recommendRequirements,type RequirementAnswers} from '../website-requirements';
let database:DatabaseSync|undefined;
function db(){
 if(!database){const root=path.join(process.cwd(),'.local-data');mkdirSync(root,{recursive:true});database=new DatabaseSync(path.join(root,'requirements.sqlite'));database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY, submission_key TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL, contact TEXT NOT NULL, answers TEXT NOT NULL, recommendation TEXT NOT NULL, consent_version TEXT NOT NULL); CREATE INDEX IF NOT EXISTS submissions_date ON submissions(created_at);`);}
 database.prepare('DELETE FROM submissions WHERE created_at < ?').run(new Date(Date.now()-90*86400000).toISOString());return database;
}
export async function canReadRequirements(request:Request){
 const account=await currentAccount(request);if(!account)return false;
 const allowed=(process.env.REQUIREMENTS_ADMIN_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
 if(allowed.length)return allowed.includes(account.email.toLowerCase());
 const hostname=new URL(request.url).hostname;
 return ['localhost','127.0.0.1','[::1]'].includes(hostname);
}
export function saveRequirements(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('입력 내용을 확인해 주세요.');
 const data=input as Record<string,unknown>;
 if(data.website)throw Error('요청을 처리할 수 없습니다.');
 if(data.consent!==true)throw Error('개인정보 수집·이용에 동의해 주세요.');
 if(typeof data.submissionKey!=='string'||!/^[a-f0-9-]{36}$/i.test(data.submissionKey))throw Error('접수 식별자가 올바르지 않습니다.');
 const raw=data.contact as Record<string,unknown>;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('담당자 정보를 입력해 주세요.');
 function text(value:unknown,max:number,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error('필수 정보와 입력 길이를 확인해 주세요.');return value.trim();}
 const contact={name:text(raw.name,80,true),company:text(raw.company,120,true),phone:text(raw.phone,40,true),email:text(raw.email,254,true).toLowerCase()};
 if(!/^[+\d][\d\s().-]{6,39}$/.test(contact.phone)||!/^\S+@\S+\.\S+$/.test(contact.email))throw Error('전화번호와 이메일 형식을 확인해 주세요.');
 const a=data.answers as Record<string,unknown>;
 if(!a||typeof a!=='object'||typeof a.delivery!=='string'||typeof a.goal!=='string'||!['website','both','blog'].includes(a.delivery)||!['start','growth','brand'].includes(a.goal))throw Error('제작물과 목적을 선택해 주세요.');
 if(!Array.isArray(a.features)||a.features.length>REQUIREMENT_FEATURES.length||a.features.some(id=>!REQUIREMENT_FEATURES.some(feature=>feature.id===id))||new Set(a.features).size!==a.features.length)throw Error('선택한 기능을 확인해 주세요.');
 const solutions=a.solutions===undefined?[]:a.solutions;
 if(!Array.isArray(solutions)||solutions.length>4||solutions.some(id=>!SPECIALIST_SOLUTIONS.some(item=>item.id===id))||new Set(solutions).size!==solutions.length)throw Error('전문 솔루션 선택을 확인해 주세요.');
 const answers:RequirementAnswers={delivery:a.delivery as RequirementAnswers['delivery'],goal:a.goal as RequirementAnswers['goal'],features:a.features as string[],solutions:solutions as string[],brand:text(a.brand,200),notes:text(a.notes,1600),timeline:text(a.timeline,200),budget:text(a.budget,200)};
 const database=db();const duplicate=database.prepare('SELECT id FROM submissions WHERE submission_key=?').get(data.submissionKey);if(duplicate)return {id:duplicate.id,duplicate:true};
 const recent=database.prepare('SELECT COUNT(*) AS count FROM submissions WHERE created_at>? AND json_extract(contact,\'$.email\')=?').get(new Date(Date.now()-15*60000).toISOString(),contact.email);
 if(Number(recent?.count)>=5)throw Error('접수 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
 const id=randomUUID(),recommendation=recommendRequirements(answers,REQUIREMENT_FEATURES);
 database.prepare('INSERT INTO submissions VALUES(?,?,?,?,?,?,?)').run(id,data.submissionKey,new Date().toISOString(),JSON.stringify(contact),JSON.stringify(answers),JSON.stringify(recommendation),'requirements-v1-90days');
 return {id,duplicate:false};
}
export function listRequirements(){return db().prepare('SELECT id,created_at,contact,answers,recommendation FROM submissions ORDER BY created_at DESC LIMIT 100').all().map(row=>({id:row.id,createdAt:row.created_at,contact:JSON.parse(String(row.contact)),answers:JSON.parse(String(row.answers)),recommendation:JSON.parse(String(row.recommendation))}));}
