import 'server-only';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {getWebsite} from './websites';
import {sendInquiryAlerts,type NotifyResults} from './inquiry-notify';
import {createRateLimiter,inquiryError,validateInquiry,INQUIRY_CONSENT_VERSION} from '../inquiry';
let database:DatabaseSync|undefined;
const perSite=createRateLimiter(5,10*60_000),overall=createRateLimiter(30,10*60_000);
function db(now=Date.now()){
 if(!database){const root=path.join(process.cwd(),'.local-data');mkdirSync(root,{recursive:true});database=new DatabaseSync(path.join(root,'inquiries.sqlite'));database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS inquiries(id TEXT PRIMARY KEY, submission_key TEXT UNIQUE NOT NULL, website_id TEXT NOT NULL, website_title TEXT NOT NULL, created_at TEXT NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL, message TEXT NOT NULL, consent_version TEXT NOT NULL, read_at TEXT, notify TEXT NOT NULL); CREATE INDEX IF NOT EXISTS inquiries_date ON inquiries(created_at);`);}
 database.prepare('DELETE FROM inquiries WHERE created_at < ?').run(new Date(now-90*86400000).toISOString());return database;
}
// Returns `alert` only for a newly stored inquiry; honeypot hits and duplicates look identical to the caller.
export async function submitInquiry(input:unknown,now=Date.now()){
 const inquiry=validateInquiry(input);
 let site;try{site=await getWebsite(inquiry.websiteId);}catch{throw inquiryError('문의를 받을 수 없는 사이트입니다.',404);}
 if(site.inquiryForm!==true)throw inquiryError('문의를 받을 수 없는 사이트입니다.',404);
 if(inquiry.honeypot)return {alert:null};
 const database=db(now);
 if(database.prepare('SELECT id FROM inquiries WHERE submission_key=?').get(inquiry.submissionKey))return {alert:null};
 if(!perSite.allows(inquiry.websiteId,now)||!overall.allows('all',now))throw inquiryError('문의가 많습니다. 잠시 후 다시 시도해 주세요.',429);
 perSite.record(inquiry.websiteId,now);overall.record('all',now);
 const id=randomUUID(),title=site.title;
 database.prepare('INSERT INTO inquiries VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,inquiry.submissionKey,inquiry.websiteId,title,new Date(now).toISOString(),inquiry.name,inquiry.contact,inquiry.message,INQUIRY_CONSENT_VERSION,null,JSON.stringify({email:'pending',slack:'pending',discord:'pending'}));
 return {alert:{id,title}};
}
// Runs after the response; any failure is recorded per channel and never affects the stored inquiry.
export async function deliverInquiryAlert(alert:{id:string;title:string}){
 let results:NotifyResults;
 try{results=await sendInquiryAlerts(alert.title);}catch{results={email:'failed',slack:'failed',discord:'failed'};}
 db().prepare('UPDATE inquiries SET notify=? WHERE id=?').run(JSON.stringify(results),alert.id);
 return results;
}
// Alerts still pending 10 minutes later never finished (e.g. process stopped); show them as unknown.
const settle=(notify:Record<string,string>,createdAt:string,now:number)=>Object.fromEntries(Object.entries(notify).map(([channel,result])=>[channel,result==='pending'&&Date.parse(createdAt)<now-10*60_000?'unknown':result]));
export function listInquiries(now=Date.now()){return db(now).prepare('SELECT id,website_id,website_title,created_at,name,contact,message,read_at,notify FROM inquiries ORDER BY created_at DESC LIMIT 100').all().map(row=>({id:String(row.id),websiteId:String(row.website_id),websiteTitle:String(row.website_title),createdAt:String(row.created_at),name:String(row.name),contact:String(row.contact),message:String(row.message),readAt:row.read_at?String(row.read_at):null,notify:settle(JSON.parse(String(row.notify)),String(row.created_at),now)}));}
export function markInquiryRead(id:string){
 if(!/^[a-f0-9-]{36}$/i.test(id))return false;
 return Number(db().prepare('UPDATE inquiries SET read_at=COALESCE(read_at,?) WHERE id=?').run(new Date().toISOString(),id).changes)>0;
}
export function unreadInquiryCount(){return Number(db().prepare('SELECT COUNT(*) AS count FROM inquiries WHERE read_at IS NULL').get()?.count||0);}
