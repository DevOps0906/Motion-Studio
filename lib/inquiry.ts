// Website inquiry form rules shared by the preview form and the server API.
export const INQUIRY_LIMITS={name:50,contact:100,message:2000,body:16*1024} as const;
export const INQUIRY_CONSENT_TEXT='문의 응대를 위해 이름·연락처·문의 내용을 수집·이용하며, 접수일로부터 90일 후 삭제합니다. 동의하지 않으면 문의를 보낼 수 없습니다.';
export const INQUIRY_CONSENT_VERSION='inquiry-v1-90days';
export type InquiryInput={websiteId:string;submissionKey:string;name:string;contact:string;message:string;honeypot:boolean};
export function inquiryError(message:string,status=400){return Object.assign(Error(message),{status});}
export function validateInquiry(input:unknown):InquiryInput{
 if(!input||typeof input!=='object'||Array.isArray(input))throw inquiryError('입력 내용을 확인해 주세요.');
 const data=input as Record<string,unknown>;
 if(typeof data.websiteId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(data.websiteId))throw inquiryError('문의를 받을 수 없는 사이트입니다.');
 if(typeof data.submissionKey!=='string'||!/^[a-f0-9-]{36}$/i.test(data.submissionKey))throw inquiryError('접수 식별자가 올바르지 않습니다.');
 if(data.consent!==true)throw inquiryError('개인정보 수집·이용에 동의해 주세요.');
 function text(value:unknown,max:number,label:string){if(typeof value!=='string'||!value.trim()||value.length>max)throw inquiryError(`${label}을(를) ${max}자 이하로 입력해 주세요.`);return value.trim();}
 const name=text(data.name,INQUIRY_LIMITS.name,'이름'),contact=text(data.contact,INQUIRY_LIMITS.contact,'연락처'),message=text(data.message,INQUIRY_LIMITS.message,'문의 내용');
 if(!/^\S+@\S+\.\S+$/.test(contact)&&!/^[+\d][\d\s().-]{6,39}$/.test(contact))throw inquiryError('연락처는 이메일 또는 전화번호 형식으로 입력해 주세요.');
 if(data.website!==undefined&&typeof data.website!=='string')throw inquiryError('입력 내용을 확인해 주세요.');
 return {websiteId:data.websiteId,submissionKey:data.submissionKey.toLowerCase(),name,contact,message,honeypot:!!data.website};
}
// Sliding-window counter kept in memory; never keyed by client-supplied headers.
export function createRateLimiter(limit:number,windowMs:number){
 const hits=new Map<string,number[]>();
 return {
  allows(key:string,now=Date.now()){
   for(const [id,times] of hits){const recent=times.filter(time=>time>now-windowMs);if(recent.length)hits.set(id,recent);else hits.delete(id);}
   return (hits.get(key)?.length||0)<limit;
  },
  record(key:string,now=Date.now()){hits.set(key,[...(hits.get(key)||[]),now]);},
 };
}
