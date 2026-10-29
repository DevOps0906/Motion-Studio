import {EMPTY_WEBSITE,validateWebsiteBrief,type WebsiteBrief} from './website';
function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function importWebsiteMetadata(text:string,current:WebsiteBrief=EMPTY_WEBSITE):WebsiteBrief{
  if(text.length>1024*1024)throw new Error('메타데이터는 1MiB 이하로 가져와 주세요.');
  let raw:unknown;
  try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('올바른 JSON 메타데이터 파일을 선택해 주세요.');}
  const root=record(raw),graph=Array.isArray(root['@graph'])?root['@graph'].map(record):[];
  const nested=record(root.homepage||root.company||root.organization);
  const source=Object.keys(nested).length?nested:graph.find(item=>['Organization','LocalBusiness','ProfessionalService'].includes(String(item['@type'])))||root;
  const seo=record(root.seo);
  function field(keys:string[],fallback=''){for(const container of [source,root])for(const key of keys){if(typeof container[key]==='string'&&(container[key] as string).trim())return (container[key] as string).trim();}return fallback;}
  const brand=field(['brand','brandName','companyName','name','브랜드명','회사명']);
  const description=field(['description','summary','소개','회사소개'],typeof seo.description==='string'?seo.description:'');
  if(!brand||!description)throw new Error('메타데이터에 브랜드명(name/brand)과 소개(description)를 포함해 주세요.');
  const offers=source.services??root.services??source.hasOfferCatalog;
  const serviceArray=Array.isArray(offers)?offers:typeof offers==='string'?offers.split(/\n|,/):[];
  const services=serviceArray.map(item=>typeof item==='string'?item:String(record(item).name||'')).filter(item=>item.trim());
  const contact=record(source.contact||root.contact),point=record(Array.isArray(source.contactPoint)?source.contactPoint[0]:source.contactPoint);
  const contactUrl=field(['contactUrl','문의URL'],typeof contact.url==='string'?contact.url:typeof point.url==='string'?point.url:'');
  const result={...current,title:field(['title','projectTitle'],typeof seo.title==='string'?seo.title:`${brand} 홈페이지`),brand,
    headline:field(['headline','tagline','slogan','핵심문구'],brand),description,audience:field(['audience','targetAudience','대상고객']),
    aboutHeading:field(['aboutHeading'],'우리의 이야기'),aboutBody:field(['aboutBody','story','상세소개'],description),
    services:services.length?services:['소개'],contactHeading:field(['contactHeading'],'함께 이야기해요.'),
    contactText:field(['contactText','문의안내'],typeof contact.text==='string'?contact.text:''),contactUrl,
    ctaLabel:field(['ctaLabel'],contactUrl?'문의하기':'자세히 보기'),
    sections:EMPTY_WEBSITE.sections.map(section=>({...section,enabled:section.id!=='contact'||Boolean(contactUrl)})),
  };
  return validateWebsiteBrief(result);
}
