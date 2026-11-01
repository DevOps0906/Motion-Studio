import {notFound} from 'next/navigation';
import {getWebsite} from '../../../lib/server/websites';
import WebsitePreview from '../../../components/WebsitePreview';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function WebsitePage({params,searchParams}: {params: Promise<{id: string}>;searchParams:Promise<{page?:string|string[]}>}) {
  const {id} = await params;
  let project;
  try { project = await getWebsite(id); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) notFound();
    throw error;
  }
  const query=await searchParams;
  const pageId=query.page;
  const page=typeof pageId==='string'?project.pages.find(item=>item.id===pageId):undefined;
  if(pageId!==undefined&&!page)notFound();
  return <main className="website-saved"><div className="website-saved-bar"><a className="button" href="/websites">← 웹사이트 제작기</a><span>저장된 미리보기 · {project.title}</span></div><WebsitePreview brief={project} page={page} previewBase={`/websites/${encodeURIComponent(id)}`} websiteId={project.inquiryForm?project.id:undefined}/></main>;
}
