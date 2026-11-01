'use client';
import {useState,type FormEvent} from 'react';
import {INQUIRY_CONSENT_TEXT,INQUIRY_LIMITS} from '../lib/inquiry';
// randomUUID needs a secure context; getRandomValues also works on plain http.
function newKey(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
type Status='idle'|'sending'|'done'|'error';
// Without websiteId (editor preview) the form is shown but never submits.
export default function WebsiteInquiryForm({websiteId}:{websiteId?:string}){
 const [status,setStatus]=useState<Status>('idle'),[error,setError]=useState(''),[key,setKey]=useState(()=>newKey());
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!websiteId||status==='sending')return;
  const form=new FormData(event.currentTarget);setStatus('sending');setError('');
  try{
   const response=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({websiteId,submissionKey:key,name:form.get('name'),contact:form.get('contact'),message:form.get('message'),consent:form.get('consent')==='on',website:form.get('website')||''})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'문의를 보내지 못했습니다.');
   setStatus('done');setKey(newKey());
  }catch(cause){setStatus('error');setError(cause instanceof Error?cause.message:'문의를 보내지 못했습니다.');}
 }
 if(status==='done')return <div className="website-inquiry-form" role="status"><strong>문의가 접수되었습니다.</strong><p>확인 후 남겨 주신 연락처로 답변드리겠습니다.</p><button type="button" onClick={()=>setStatus('idle')}>새 문의 작성</button></div>;
 return <form className="website-inquiry-form" onSubmit={submit} aria-label="문의 보내기">
  <label>이름<input name="name" required maxLength={INQUIRY_LIMITS.name} autoComplete="name"/></label>
  <label>연락처 · 이메일 또는 전화번호<input name="contact" required maxLength={INQUIRY_LIMITS.contact} autoComplete="email"/></label>
  <label>문의 내용<textarea name="message" required rows={5} maxLength={INQUIRY_LIMITS.message}/></label>
  <label className="website-inquiry-trap" aria-hidden="true">웹사이트<input name="website" tabIndex={-1} autoComplete="off"/></label>
  <label className="website-inquiry-consent"><input type="checkbox" name="consent" required/><span>[필수] 개인정보 수집·이용 동의<small>{INQUIRY_CONSENT_TEXT}</small></span></label>
  {error&&<p role="alert">{error}</p>}
  <button className="website-cta" type="submit" disabled={!websiteId||status==='sending'}>{status==='sending'?'보내는 중…':'문의 보내기'}</button>
  {!websiteId&&<p className="website-inquiry-note">편집기 미리보기에서는 전송되지 않습니다. 저장 후 저장된 미리보기에서 확인하세요.</p>}
 </form>;
}
