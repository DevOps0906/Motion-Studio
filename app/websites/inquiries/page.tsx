import {headers} from 'next/headers';
import WebsiteInquiriesInbox from '../../../components/WebsiteInquiriesInbox';
import {canReadRequirements} from '../../../lib/server/website-requirements';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export default async function WebsiteInquiriesPage(){
 const incoming=await headers();
 // Same rule as the API: operator session cookie, or localhost when no admin emails are configured.
 let allowed=false;
 try{allowed=await canReadRequirements(new Request(`http://${incoming.get('host')||'localhost'}/websites/inquiries`,{headers:{cookie:incoming.get('cookie')||''}}));}catch{allowed=false;}
 if(!allowed)return <main className="requirements-page"><header className="requirements-hero"><span className="product-kicker">WEBSITE INQUIRIES</span><h1>웹사이트 문의함</h1><p role="alert">문의 내역을 확인할 운영자 계정으로 로그인해 주세요. <a href="/login">로그인</a></p></header></main>;
 return <WebsiteInquiriesInbox/>;
}
