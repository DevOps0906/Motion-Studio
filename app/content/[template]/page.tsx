import {notFound} from 'next/navigation';
import {CONTENT_TEMPLATES} from '../../../lib/content-template-data';
import ContentTemplateBuilder from '../../../components/ContentTemplateBuilder';
export default async function ContentPage({params}:{params:Promise<{template:string}>}){const {template}=await params;if(!CONTENT_TEMPLATES.some(item=>item.id===template))notFound();return <ContentTemplateBuilder templateId={template}/>;}
