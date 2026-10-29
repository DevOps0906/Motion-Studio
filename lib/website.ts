export const WEBSITE_SECTION_LABELS = {about: '브랜드 소개', services: '서비스', contact: '문의 안내'} as const;
export type WebsiteSectionId = keyof typeof WEBSITE_SECTION_LABELS;
export type WebsiteSection = {id: WebsiteSectionId; enabled: boolean};
export const DEFAULT_WEBSITE_SECTIONS: WebsiteSection[] = [
  {id: 'about', enabled: true}, {id: 'services', enabled: true}, {id: 'contact', enabled: true},
];
const LEGACY_SECTIONS: WebsiteSection[] = DEFAULT_WEBSITE_SECTIONS.map(section => ({...section, enabled: section.id === 'services'}));

export type WebsiteBrief = {
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
  designPreset: 'studio', referenceTitle: '',
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
  const referenceTitle = optionalText('referenceTitle', 180);
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
    sections, aboutHeading, aboutBody, contactHeading, contactText, contactUrl, designPreset: designPreset as WebsiteBrief['designPreset'], referenceTitle};
}
