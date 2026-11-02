import WebsiteInquiriesInbox from '../../../components/WebsiteInquiriesInbox';
import {requirePageAccount} from '../../../lib/server/page-session';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export default async function WebsiteInquiriesPage(){
 const account=await requirePageAccount();
 // Same rule as the API: every account sees the inquiries of its own websites. A session without an id (before migrate:owner) must log in again.
 if(!account.id)return <main className="requirements-page"><header className="requirements-hero"><span className="product-kicker">WEBSITE INQUIRIES</span><h1>웹사이트 문의함</h1><p role="alert">계정 정보가 갱신되었습니다. 다시 로그인해 주세요. <a href="/login">로그인</a></p></header></main>;
 return <WebsiteInquiriesInbox/>;
}
