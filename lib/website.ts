import {validateProductionBrief,type WebsiteProductionBrief} from './website-production';
export const WEBSITE_SECTION_LABELS = {about: '브랜드 소개', services: '서비스', contact: '문의 안내'} as const;
export type WebsiteSectionId = keyof typeof WEBSITE_SECTION_LABELS;
export type WebsiteSection = {id: WebsiteSectionId; enabled: boolean};
export type WebsitePageContent = Pick<WebsiteBrief,'aboutHeading'|'aboutBody'|'services'|'contactHeading'|'contactText'|'contactUrl'|'ctaLabel'>;
export type WebsitePage = {content?:WebsitePageContent;id: string; title: string; headline: string; description: string; sections: WebsiteSection[]};
export const DEFAULT_WEBSITE_SECTIONS: WebsiteSection[] = [
  {id: 'about', enabled: true}, {id: 'services', enabled: true}, {id: 'contact', enabled: true},
];
const LEGACY_SECTIONS: WebsiteSection[] = DEFAULT_WEBSITE_SECTIONS.map(section => ({...section, enabled: section.id === 'services'}));

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
  designPreset: 'studio' | 'editorial' | 'gallery';
  referenceTitle: string;
  pages: WebsitePage[];
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
  designPreset: 'studio', referenceTitle: '', designKit: 'original',
  pages: [],
};

export function safeWebsiteLink(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function websiteCtaHref(brief: WebsiteBrief) {
  const visible = brief.sections.filter(section => section.enabled);
  const contact = safeWebsiteLink(brief.contactUrl);
  return visible.some(section => section.id === 'contact') && contact
    ? contact : visible.length ? `#website-${visible[0].id}` : '';
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
    if (!Array.isArray(page.sections) || page.sections.length !== 3) throw new Error('페이지 섹션 구성을 확인해 주세요.');
    const sections = page.sections.map((section): WebsiteSection => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) throw new Error('페이지 섹션 정보를 확인해 주세요.');
      const value = section as Record<string, unknown>;
      if (typeof value.id !== 'string' || !Object.prototype.hasOwnProperty.call(WEBSITE_SECTION_LABELS, value.id) || typeof value.enabled !== 'boolean') throw new Error('페이지 섹션 정보를 확인해 주세요.');
      return {id: value.id as WebsiteSectionId, enabled: value.enabled};
    });
    if (new Set(sections.map(section => section.id)).size !== 3) throw new Error('페이지 섹션이 중복되었습니다.');
    let content:WebsitePageContent|undefined;
    if(page.content!==undefined){
      if(!page.content||typeof page.content!=='object'||Array.isArray(page.content))throw new Error('페이지 상세 내용을 확인해 주세요.');
      const raw=page.content as Record<string,unknown>;
      const field=(key:string,max:number,required=false)=>{const value=raw[key];if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error('페이지 상세 문구의 길이와 필수 항목을 확인해 주세요.');return value.trim();};
      const services=raw.services;
      if(!Array.isArray(services)||services.length<1||services.length>6||services.some(value=>typeof value!=='string'||!value.trim()||value.length>100))throw new Error('페이지 서비스는 1~6개, 항목별 100자 이하로 입력해 주세요.');
      const contactUrl=field('contactUrl',2000);
      if(contactUrl&&!safeWebsiteLink(contactUrl))throw new Error('페이지 문의 링크는 인증 정보 없는 http 또는 https 주소로 입력해 주세요.');
      content={aboutHeading:field('aboutHeading',120),aboutBody:field('aboutBody',1200),services:services.map(value=>(value as string).trim()),contactHeading:field('contactHeading',120),contactText:field('contactText',1200),contactUrl,ctaLabel:field('ctaLabel',40,true)};
    }
    return {id, title, headline: pageHeadline, description: pageDescription, sections, ...(content?{content}:{})};
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
  if (!Array.isArray(rawSections) || rawSections.length !== 3) throw new Error('소개·서비스·문의 섹션 구성을 확인해 주세요.');
  const seen = new Set<string>();
  const sections = rawSections.map((section: unknown): WebsiteSection => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) throw new Error('잘못된 섹션입니다.');
    const {id, enabled} = section as Record<string, unknown>;
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(WEBSITE_SECTION_LABELS, id) || seen.has(id) || typeof enabled !== 'boolean') throw new Error('섹션 종류·중복·표시 설정을 확인해 주세요.');
    seen.add(id);
    return {id: id as WebsiteSectionId, enabled};
  });
  return {title, brand, headline, description, audience, referenceUrl, ctaLabel, accent,
    theme: data.theme, heroImageId, services: data.services.map(s => (s as string).trim()),
    sections, aboutHeading, aboutBody, contactHeading, contactText, contactUrl, designPreset: designPreset as WebsiteBrief['designPreset'], referenceTitle, designKit: designKit as WebsiteBrief['designKit'], productionBrief: validateProductionBrief(data.productionBrief), pages};
}

// One page projection shared by the editor preview and the downloadable site.
export function resolveWebsitePage(brief:WebsiteBrief,page?:WebsitePage):WebsiteBrief {
  return page?{...brief,...page.content,title:page.title,headline:page.headline,description:page.description,sections:page.sections}:brief;
}
