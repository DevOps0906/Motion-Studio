import {redirect,notFound} from 'next/navigation';
import WebsiteBuilder from '../../../../components/WebsiteBuilder';
import {WEBSITE_TYPES,type WebsiteType} from '../../../../lib/website-types';
import '../../websites.css';
export default async function WebsiteEditor({params}:{params:Promise<{tier:string}>}){
 const {tier}=await params;
 if(tier==='intermediate')redirect('/websites/editor/business');
 if(tier==='advanced')redirect('/websites/editor/premium');
 if(!Object.prototype.hasOwnProperty.call(WEBSITE_TYPES,tier))notFound();
 return <WebsiteBuilder initialType={tier as WebsiteType}/>;
}
