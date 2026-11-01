import {EMPTY_WEBSITE,WEBSITE_SECTION_LABELS,type WebsiteBrief,type WebsiteSection} from './website';
// Draft generation may only touch these home fields; FAQ·testimonials·contact·images·pages stay as entered.
export const WEBSITE_DRAFT_FIELDS=['headline','aboutHeading','aboutBody','services','ctaLabel','sections'] as const;
export type WebsiteDraftField=typeof WEBSITE_DRAFT_FIELDS[number];
export type WebsiteDraft=Pick<WebsiteBrief,WebsiteDraftField>;
export type WebsiteDraftMode='fill'|'overwrite';
export const WEBSITE_DRAFT_FIELD_LABELS:Record<WebsiteDraftField,string>={headline:'핵심 문구',aboutHeading:'소개 제목',aboutBody:'소개 본문',services:'서비스',ctaLabel:'버튼 문구',sections:'섹션 표시'};
// Source facts the rule draft may use. Anything else is ignored.
export type WebsiteDraftSource={brand:string;description:string;audience:string;services:string[];industry:string;goal:string;offer:string;referenceTitle:string;referenceUrl:string;designPreset:WebsiteBrief['designPreset'];sections:WebsiteSection[];hasContact:boolean};
function str(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}
function clip(value:string,max:number){return value.length>max?value.slice(0,max).trim():value;}
export function websiteDraftSource(input:unknown):WebsiteDraftSource{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('웹 프로젝트 정보를 입력해 주세요.');
 const data=input as Record<string,unknown>,production=data.productionBrief&&typeof data.productionBrief==='object'&&!Array.isArray(data.productionBrief)?data.productionBrief as Record<string,unknown>:{};
 const services=Array.isArray(data.services)?data.services.map(value=>str(value,100)).filter(Boolean).slice(0,6):[];
 const sections=Array.isArray(data.sections)&&data.sections.every(item=>item&&typeof item==='object'&&typeof (item as WebsiteSection).id==='string'&&typeof (item as WebsiteSection).enabled==='boolean'&&Object.prototype.hasOwnProperty.call(WEBSITE_SECTION_LABELS,(item as WebsiteSection).id))&&new Set(data.sections.map(item=>(item as WebsiteSection).id)).size===data.sections.length?(data.sections as WebsiteSection[]).map(item=>({id:item.id,enabled:item.enabled})):EMPTY_WEBSITE.sections.map(section=>({...section}));
 const designPreset=['studio','editorial','gallery'].includes(data.designPreset as string)?data.designPreset as WebsiteBrief['designPreset']:'studio';
 return {brand:str(data.brand,80),description:str(data.description,1200),audience:str(data.audience,200),services,industry:str(production.industry,200),goal:str(production.goal,300),offer:str(production.offer,600),referenceTitle:str(data.referenceTitle,180),referenceUrl:str(data.referenceUrl,2000),designPreset,sections,hasContact:Boolean(str(data.contactUrl,2000)||str(data.contactText,1200)||data.inquiryForm===true)};
}
// Fields allowed to leave the server for OpenAI (task-004 7.4). Budget·schedule·operations·contact are never sent.
export function websiteDraftAiInput(source:WebsiteDraftSource){
 return {brand:source.brand,description:source.description,audience:source.audience,services:source.services,productionBrief:{industry:source.industry,goal:source.goal,offer:source.offer},referenceTitle:source.referenceTitle,designPreset:source.designPreset};
}
function draftSections(source:WebsiteDraftSource,services:string[],aboutBody:string){
 return source.sections.map(section=>section.id==='about'?{...section,enabled:section.enabled||Boolean(aboutBody)}:section.id==='services'?{...section,enabled:section.enabled||services.length>0}:section.id==='contact'?{...section,enabled:section.enabled||source.hasContact}:{...section});
}
// Rule draft: rearranges entered facts only. No industry claims, results, contacts or reviews are invented.
export function automaticWebsiteDraft(source:WebsiteDraftSource):WebsiteDraft{
 const firstSentence=source.description.split(/(?<=[.!?。])\s+|\n+/)[0]?.trim()||'';
 const headline=clip(firstSentence||source.offer.split(/\n+/)[0]?.trim()||source.brand||EMPTY_WEBSITE.headline,160);
 const aboutHeading=source.brand?clip(`${source.brand} 소개`,120):EMPTY_WEBSITE.aboutHeading;
 const aboutBody=clip([source.description,source.audience?`대상 고객: ${source.audience}`:''].filter(Boolean).join('\n\n'),1200);
 const offered=source.offer.split(/\n|,|·/).map(value=>clip(value.trim(),100)).filter(Boolean).slice(0,6);
 const services=source.services.length?source.services:offered.length?offered:[...EMPTY_WEBSITE.services];
 const ctaLabel=source.hasContact?'문의하기':services.length?'서비스 살펴보기':EMPTY_WEBSITE.ctaLabel;
 return {headline,aboutHeading,aboutBody,services,ctaLabel,sections:draftSections(source,services,aboutBody)};
}
// Validates a generated draft on its own; throws on any shape or length violation.
export function validateWebsiteDraft(input:unknown,source:WebsiteDraftSource):WebsiteDraft{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('초안 형식이 올바르지 않습니다.');
 const data=input as Record<string,unknown>;
 const text=(key:string,max:number,required:boolean)=>{const value=data[key];if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error('초안 문구 길이를 확인해 주세요.');return value.trim();};
 const headline=text('headline',160,true),aboutHeading=text('aboutHeading',120,true),aboutBody=text('aboutBody',1200,false),ctaLabel=text('ctaLabel',40,true);
 if(!Array.isArray(data.services)||data.services.length<1||data.services.length>6||data.services.some(value=>typeof value!=='string'||!value.trim()||value.length>100))throw Error('초안 서비스 구성을 확인해 주세요.');
 const show=data.showSections as Record<string,unknown>;
 if(!show||typeof show!=='object'||Array.isArray(show)||['about','services','contact'].some(id=>typeof show[id]!=='boolean'))throw Error('초안 섹션 구성을 확인해 주세요.');
 const sections=source.sections.map(section=>['about','services','contact'].includes(section.id)?{...section,enabled:show[section.id] as boolean}:{...section});
 return {headline,aboutHeading,aboutBody,services:data.services.map(value=>(value as string).trim()),ctaLabel,sections};
}
function same(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}
// "Blank" = whitespace-only text, empty list, or still the EMPTY_WEBSITE default (team lead decision, 7.3).
export function isBlankDraftValue(field:WebsiteDraftField,value:unknown){
 if(typeof value==='string')return !value.trim()||value.trim()===EMPTY_WEBSITE[field];
 if(Array.isArray(value)){if(!value.length)return true;if(field==='services'&&value.every(item=>typeof item==='string'&&!item.trim()))return true;return same(value,EMPTY_WEBSITE[field]);}
 return value===undefined||value===null;
}
export function websiteDraftChanges(brief:WebsiteBrief,draft:WebsiteDraft,mode:WebsiteDraftMode):WebsiteDraftField[]{
 return WEBSITE_DRAFT_FIELDS.filter(field=>(mode==='overwrite'||isBlankDraftValue(field,brief[field]))&&!same(brief[field],draft[field]));
}
export function pickWebsiteDraft(brief:WebsiteBrief):WebsiteDraft{
 return {headline:brief.headline,aboutHeading:brief.aboutHeading,aboutBody:brief.aboutBody,services:[...brief.services],ctaLabel:brief.ctaLabel,sections:brief.sections.map(section=>({...section}))};
}
// Applies only the draft fields; returns the previous values of the fields it actually changed so the editor can undo once.
export function applyWebsiteDraft(brief:WebsiteBrief,draft:WebsiteDraft,mode:WebsiteDraftMode){
 const changed=websiteDraftChanges(brief,draft,mode),next:WebsiteBrief={...brief};
 for(const field of changed)(next as Record<WebsiteDraftField,unknown>)[field]=field==='services'?[...draft.services]:field==='sections'?draft.sections.map(section=>({...section})):draft[field];
 const before=pickWebsiteDraft(brief),previous:Partial<WebsiteDraft>={};
 for(const field of changed)(previous as Record<WebsiteDraftField,unknown>)[field]=before[field];
 return {brief:next,changed,previous};
}
// Restores only the fields the draft changed; later edits to any other field are kept.
export function undoWebsiteDraft(brief:WebsiteBrief,previous:Partial<WebsiteDraft>):WebsiteBrief{
 const next:WebsiteBrief={...brief};
 for(const field of WEBSITE_DRAFT_FIELDS)if(Object.prototype.hasOwnProperty.call(previous,field))(next as Record<WebsiteDraftField,unknown>)[field]=previous[field];
 return next;
}
