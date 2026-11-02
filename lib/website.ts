import {validateProductionBrief,type WebsiteProductionBrief} from './website-production';
export const WEBSITE_SECTION_LABELS = {about: '브랜드 소개', services: '서비스', contact: '문의 안내', testimonials: '고객 후기', faq: '자주 묻는 질문', gallery: '갤러리'} as const;
export type WebsiteSectionId = keyof typeof WEBSITE_SECTION_LABELS;
export type WebsiteSection = {id: WebsiteSectionId; enabled: boolean};
export type WebsiteGalleryItem = {imageId: string; caption?: string};
// Testimonials/FAQ/gallery keys are optional: a missing key means the page follows the home value.
export type WebsitePageContent = Pick<WebsiteBrief,'aboutHeading'|'aboutBody'|'services'|'contactHeading'|'contactText'|'contactUrl'|'ctaLabel'> & Partial<Pick<WebsiteBrief,'testimonialsHeading'|'testimonials'|'faqHeading'|'faqs'|'gallery'>>;
export type WebsiteTestimonial = {quote: string; name: string};
export type WebsiteFaq = {question: string; answer: string};
export type WebsitePage = {content?:WebsitePageContent;heroImageId?:string;id: string; title: string; headline: string; description: string; sections: WebsiteSection[]};
export const DEFAULT_WEBSITE_SECTIONS: WebsiteSection[] = [
  {id: 'about', enabled: true}, {id: 'services', enabled: true}, {id: 'contact', enabled: true},
  {id: 'testimonials', enabled: false}, {id: 'faq', enabled: false}, {id: 'gallery', enabled: false},
];
// Sections added after the first release; stored 3-section data is completed with these hidden.
const ADDED_SECTION_IDS: WebsiteSectionId[] = ['testimonials', 'faq', 'gallery'];
function withAddedSections(sections: WebsiteSection[]) {
  return [...sections, ...ADDED_SECTION_IDS.filter(id => !sections.some(section => section.id === id)).map(id => ({id, enabled: false}))];
}
const LEGACY_SECTIONS: WebsiteSection[] = DEFAULT_WEBSITE_SECTIONS.map(section => ({...section, enabled: section.id === 'services'}));
const SECTION_COUNT = DEFAULT_WEBSITE_SECTIONS.length;

export const WEBSITE_DESIGN_KITS = {
  original: '기존 디자인 유지',
  minimal: '미니멀 · 선명한 타이포와 직선',
  publication: '퍼블리케이션 · 세리프와 넓은 여백',
  portfolio: '포트폴리오 · 이미지와 부드러운 모서리',
} as const;
export type WebsiteBrief = {
  productionBrief?: WebsiteProductionBrief;
  designKit: keyof typeof WEBSITE_DESIGN_KITS;
  title: string;
  brand: string;
  headline: string;
  description: string;
  audience: string;
  referenceUrl: string;
  ctaLabel: string;
  services: string[];
  accent: string;
  theme: 'dark' | 'light';
  heroImageId: string;
  sections: WebsiteSection[];
  aboutHeading: string;
  aboutBody: string;
  contactHeading: string;
  contactText: string;
  contactUrl: string;
  testimonialsHeading: string;
  testimonials: WebsiteTestimonial[];
  faqHeading: string;
  faqs: WebsiteFaq[];
  gallery: WebsiteGalleryItem[];
  designPreset: 'studio' | 'editorial' | 'gallery';
  referenceTitle: string;
  pages: WebsitePage[];
  inquiryForm: boolean;
};

export type WebsiteProject = WebsiteBrief & {
  id: string;
  schemaVersion: 1;
  templateId: 'brand-landing-v1';
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_WEBSITE: WebsiteBrief = {
  title: '', brand: '', headline: '', description: '', audience: '', referenceUrl: '',
  ctaLabel: '브랜드 알아보기', services: ['브랜드 전략', '디지털 경험', '콘텐츠 제작'],
  accent: '#c4b5fd', theme: 'dark', heroImageId: '',
  sections: DEFAULT_WEBSITE_SECTIONS.map(section => ({...section})),
  aboutHeading: '우리의 이야기', aboutBody: '', contactHeading: '함께 다음 장면을 만드세요.', contactText: '', contactUrl: '',
  testimonialsHeading: '고객 후기', testimonials: [], faqHeading: '자주 묻는 질문', faqs: [], gallery: [],
  designPreset: 'studio', referenceTitle: '', designKit: 'original',
  pages: [], inquiryForm: false,
};

export function safeWebsiteLink(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function websiteCtaHref(brief: WebsiteBrief) {
  // Empty testimonial/FAQ sections are not rendered, so they cannot be CTA targets.
  // The gallery is not a CTA target either.
  const visible = brief.sections.filter(section => section.enabled && section.id !== 'gallery' && !(section.id === 'testimonials' && !brief.testimonials.length) && !(section.id === 'faq' && !brief.faqs.length));
  const contact = safeWebsiteLink(brief.contactUrl);
  return visible.some(section => section.id === 'contact') && contact
    ? contact : visible.length ? `#website-${visible[0].id}` : '';
}

const IMAGE_ID = /^[a-zA-Z0-9-]{1,80}$/;
function reviewList(value: unknown, max: number, message: string) {
  const list = value === undefined ? [] : value;
  if (!Array.isArray(list) || list.length > max || list.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error(message);
  return list as Record<string, unknown>[];
}
function itemText(value: unknown, required: boolean, label: string, max = 300) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`${label}: 내용을 ${max}자 이하로 입력해 주세요.`);
  return value.trim();
}
function parseTestimonials(value: unknown): WebsiteTestimonial[] {
  return reviewList(value, 6, '고객 후기는 최대 6개까지 입력할 수 있습니다.').map(item => ({quote: itemText(item.quote, true, '후기 내용'), name: itemText(item.name, false, '후기 작성자')}));
}
function parseFaqs(value: unknown): WebsiteFaq[] {
  return reviewList(value, 8, '자주 묻는 질문은 최대 8개까지 입력할 수 있습니다.').map(item => ({question: itemText(item.question, true, '질문'), answer: itemText(item.answer, true, '답변')}));
}
function parseGallery(value: unknown): WebsiteGalleryItem[] {
  const seen = new Set<string>();
  return reviewList(value, 12, '갤러리 이미지는 최대 12장까지 선택할 수 있습니다.').map((item): WebsiteGalleryItem => {
    if (typeof item.imageId !== 'string' || !IMAGE_ID.test(item.imageId)) throw new Error('갤러리 이미지 ID가 올바르지 않습니다.');
    if (seen.has(item.imageId)) throw new Error('같은 이미지를 갤러리에 두 번 넣을 수 없습니다.');
    seen.add(item.imageId);
    const caption = itemText(item.caption, false, '갤러리 설명', 120);
    return {imageId: item.imageId, ...(caption ? {caption} : {})};
  });
}

export function validateWebsiteBrief(input: unknown): WebsiteBrief {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('웹 프로젝트 정보를 입력해 주세요.');
  const data = input as Record<string, unknown>;
  function text(key: string, max: number, required = false) {
    const value = data[key];
    if (typeof value !== 'string' || value.length > max) throw new Error(`${key}: ${max}자 이하의 문자열이 필요합니다.`);
    const trimmed = value.trim();
    if (required && !trimmed) throw new Error(`${key}: 내용을 입력해 주세요.`);
    return trimmed;
  }
  const title = text('title', 120, true), brand = text('brand', 80, true);
  const headline = text('headline', 160, true), description = text('description', 1200, true);
  const audience = text('audience', 200), referenceUrl = text('referenceUrl', 2000);
  const ctaLabel = text('ctaLabel', 40, true), accent = text('accent', 7);
  const heroImageId = text('heroImageId', 80);
  function optionalText(key: string, max: number, fallback = '') {
    return data[key] === undefined ? fallback : text(key, max);
  }
  const aboutHeading = optionalText('aboutHeading', 120, '우리의 이야기');
  const aboutBody = optionalText('aboutBody', 1200);
  const contactHeading = optionalText('contactHeading', 120, '함께 다음 장면을 만드세요.');
  const contactText = optionalText('contactText', 1200), contactUrl = optionalText('contactUrl', 2000);
  const designPreset = data.designPreset === undefined ? 'studio' : data.designPreset;
  if (!['studio','editorial','gallery'].includes(designPreset as string)) throw new Error('지원하지 않는 디자인 방향입니다.');
  const designKit = data.designKit === undefined ? 'original' : data.designKit;
  if (typeof designKit !== 'string' || !Object.prototype.hasOwnProperty.call(WEBSITE_DESIGN_KITS, designKit)) throw new Error('지원하지 않는 디자인 키트입니다.');
  const referenceTitle = optionalText('referenceTitle', 180);
  const rawPages = data.pages === undefined ? [] : data.pages;
  if (!Array.isArray(rawPages) || rawPages.length > 12) throw new Error('추가 페이지는 최대 12개까지 만들 수 있습니다.');
  const pageIds = new Set<string>();
  const pages = rawPages.map((raw): WebsitePage => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('페이지 정보를 확인해 주세요.');
    const page = raw as Record<string, unknown>;
    const id = typeof page.id === 'string' ? page.id : '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 48 || id === 'index' || pageIds.has(id)) throw new Error('페이지 주소는 영문 소문자·숫자·하이픈으로 중복 없이 입력해 주세요.');
    pageIds.add(id);
    const title = typeof page.title === 'string' ? page.title.trim() : '';
    const pageHeadline = typeof page.headline === 'string' ? page.headline.trim() : '';
    const pageDescription = typeof page.description === 'string' ? page.description.trim() : '';
    if (!title || title.length > 80 || !pageHeadline || pageHeadline.length > 160 || pageDescription.length > 1200) throw new Error('페이지 이름·제목·소개 길이를 확인해 주세요.');
    if (!Array.isArray(page.sections) || (page.sections.length !== 3 && page.sections.length !== 5 && page.sections.length !== SECTION_COUNT)) throw new Error('페이지 섹션 구성을 확인해 주세요.');
    const sections = page.sections.map((section): WebsiteSection => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) throw new Error('페이지 섹션 정보를 확인해 주세요.');
      const value = section as Record<string, unknown>;
      if (typeof value.id !== 'string' || !Object.prototype.hasOwnProperty.call(WEBSITE_SECTION_LABELS, value.id) || typeof value.enabled !== 'boolean') throw new Error('페이지 섹션 정보를 확인해 주세요.');
      return {id: value.id as WebsiteSectionId, enabled: value.enabled};
    });
    if (new Set(sections.map(section => section.id)).size !== sections.length) throw new Error('페이지 섹션이 중복되었습니다.');
    const pageSections = withAddedSections(sections);
    if (pageSections.length !== SECTION_COUNT) throw new Error('페이지 섹션 구성을 확인해 주세요.');
    const pageImageId = page.heroImageId === undefined ? '' : page.heroImageId;
    if (typeof pageImageId !== 'string' || (pageImageId && !/^[a-zA-Z0-9-]{1,80}$/.test(pageImageId))) throw new Error('페이지 대표 이미지 ID가 올바르지 않습니다.');
    let content:WebsitePageContent|undefined;
    if(page.content!==undefined){
      if(!page.content||typeof page.content!=='object'||Array.isArray(page.content))throw new Error('페이지 상세 내용을 확인해 주세요.');
      const raw=page.content as Record<string,unknown>;
      const field=(key:string,max:number,required=false)=>{const value=raw[key];if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error('페이지 상세 문구의 길이와 필수 항목을 확인해 주세요.');return value.trim();};
      const services=raw.services;
      if(!Array.isArray(services)||services.length<1||services.length>6||services.some(value=>typeof value!=='string'||!value.trim()||value.length>100))throw new Error('페이지 서비스는 1~6개, 항목별 100자 이하로 입력해 주세요.');
      const contactUrl=field('contactUrl',2000);
      if(contactUrl&&!safeWebsiteLink(contactUrl))throw new Error('페이지 문의 링크는 인증 정보 없는 http 또는 https 주소로 입력해 주세요.');
      const optional:Partial<WebsitePageContent>={};
      const heading=(key:'testimonialsHeading'|'faqHeading')=>{const value=raw[key];if(value===undefined)return;if(typeof value!=='string'||value.length>120)throw new Error('페이지 후기·FAQ 제목은 120자 이하로 입력해 주세요.');optional[key]=value.trim();};
      heading('testimonialsHeading');heading('faqHeading');
      if(raw.testimonials!==undefined)optional.testimonials=parseTestimonials(raw.testimonials);
      if(raw.faqs!==undefined)optional.faqs=parseFaqs(raw.faqs);
      if(raw.gallery!==undefined)optional.gallery=parseGallery(raw.gallery);
      content={aboutHeading:field('aboutHeading',120),aboutBody:field('aboutBody',1200),services:services.map(value=>(value as string).trim()),contactHeading:field('contactHeading',120),contactText:field('contactText',1200),contactUrl,ctaLabel:field('ctaLabel',40,true),...optional};
    }
    return {id, title, headline: pageHeadline, description: pageDescription, sections: pageSections, ...(pageImageId?{heroImageId: pageImageId}:{}), ...(content?{content}:{})};
  });
  if (referenceUrl) {
    let url: URL;
    try { url = new URL(referenceUrl); } catch { throw new Error('참고 URL은 http 또는 https 주소로 입력해 주세요.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('참고 URL은 인증 정보 없는 http 또는 https 주소여야 합니다.');
  }
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new Error('강조색은 6자리 HEX 색상이어야 합니다.');
  if (contactUrl) {
    let url: URL;
    try { url = new URL(contactUrl); } catch { throw new Error('문의 링크는 http 또는 https 주소로 입력해 주세요.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('문의 링크는 인증 정보 없는 http 또는 https 주소여야 합니다.');
  }
  if (data.theme !== 'dark' && data.theme !== 'light') throw new Error('지원하지 않는 테마입니다.');
  if (heroImageId && !/^[a-zA-Z0-9-]{1,80}$/.test(heroImageId)) throw new Error('이미지 ID가 올바르지 않습니다.');
  if (!Array.isArray(data.services) || data.services.length < 1 || data.services.length > 6 || data.services.some(s => typeof s !== 'string' || !s.trim() || s.length > 100)) throw new Error('서비스는 1~6개, 항목별 100자 이하로 입력해 주세요.');
  const rawSections = data.sections === undefined ? LEGACY_SECTIONS : data.sections;
  if (!Array.isArray(rawSections) || (rawSections.length !== 3 && rawSections.length !== 5 && rawSections.length !== SECTION_COUNT)) throw new Error('소개·서비스·문의 섹션 구성을 확인해 주세요.');
  const seen = new Set<string>();
  const givenSections = rawSections.map((section: unknown): WebsiteSection => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) throw new Error('잘못된 섹션입니다.');
    const {id, enabled} = section as Record<string, unknown>;
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(WEBSITE_SECTION_LABELS, id) || seen.has(id) || typeof enabled !== 'boolean') throw new Error('섹션 종류·중복·표시 설정을 확인해 주세요.');
    seen.add(id);
    return {id: id as WebsiteSectionId, enabled};
  });
  const sections = withAddedSections(givenSections);
  if (sections.length !== SECTION_COUNT) throw new Error('소개·서비스·문의 섹션 구성을 확인해 주세요.');
  const testimonialsHeading = optionalText('testimonialsHeading', 120, '고객 후기');
  const faqHeading = optionalText('faqHeading', 120, '자주 묻는 질문');
  const testimonials = parseTestimonials(data.testimonials);
  if (data.inquiryForm !== undefined && typeof data.inquiryForm !== 'boolean') throw new Error('문의 폼 사용 여부를 확인해 주세요.');
  const inquiryForm = data.inquiryForm === true;
  const faqs = parseFaqs(data.faqs), gallery = parseGallery(data.gallery);
  return {title, brand, headline, description, audience, referenceUrl, ctaLabel, accent,
    theme: data.theme, heroImageId, services: data.services.map(s => (s as string).trim()),
    sections, aboutHeading, aboutBody, contactHeading, contactText, contactUrl, testimonialsHeading, testimonials, faqHeading, faqs, gallery, designPreset: designPreset as WebsiteBrief['designPreset'], referenceTitle, designKit: designKit as WebsiteBrief['designKit'], productionBrief: validateProductionBrief(data.productionBrief), pages, inquiryForm};
}

// Blank review rows are editor scratch space; drop them before strict validation on save.
export function dropEmptyReviewItems(brief:WebsiteBrief):WebsiteBrief {
  const quotes=(items:WebsiteTestimonial[])=>items.filter(item=>item.quote.trim()),questions=(items:WebsiteFaq[])=>items.filter(item=>item.question.trim()||item.answer.trim());
  return {...brief,testimonials:quotes(brief.testimonials),faqs:questions(brief.faqs),pages:brief.pages.map(page=>{
    const content=page.content;
    return content?{...page,content:{...content,...(content.testimonials?{testimonials:quotes(content.testimonials)}:{}),...(content.faqs?{faqs:questions(content.faqs)}:{})}}:page;
  })};
}
// Testimonial/FAQ text is shared, so its fields matter when any page shows the section.
export function websiteSectionUsed(brief:WebsiteBrief,id:WebsiteSectionId) {
  return [brief.sections,...brief.pages.map(page=>page.sections)].some(sections=>sections.some(section=>section.id===id&&section.enabled));
}

// One page projection shared by the editor preview and the downloadable site.
export function resolveWebsitePage(brief:WebsiteBrief,page?:WebsitePage):WebsiteBrief {
  return page?{...brief,...page.content,heroImageId:page.heroImageId||brief.heroImageId,title:page.title,headline:page.headline,description:page.description,sections:page.sections}:brief;
}

// Gallery images shown on one page: only when its gallery section is on, in saved order.
// `available` (media ids that still exist) drops deleted images; alt text falls back to a numbered label.
export function visibleGallery(current:WebsiteBrief,available?:ReadonlySet<string>) {
  if(!current.sections.some(section=>section.id==='gallery'&&section.enabled))return [];
  return (current.gallery||[]).filter(item=>!available||available.has(item.imageId)).map((item,index)=>({imageId:item.imageId,caption:item.caption||'',alt:item.caption||`${current.brand||'브랜드'} 갤러리 이미지 ${index+1}`}));
}
// Single source for "which gallery images are in use": preview, export and the public-media rule all call this.
export function websiteGalleryImageIds(brief:WebsiteBrief) {
  const ids=new Set<string>();
  for(const page of [undefined,...brief.pages])for(const item of visibleGallery(resolveWebsitePage(brief,page)))ids.add(item.imageId);
  return Array.from(ids);
}
