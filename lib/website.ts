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
};

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
  if (referenceUrl) {
    let url: URL;
    try { url = new URL(referenceUrl); } catch { throw new Error('참고 URL은 http 또는 https 주소로 입력해 주세요.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('참고 URL은 인증 정보 없는 http 또는 https 주소여야 합니다.');
  }
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new Error('강조색은 6자리 HEX 색상이어야 합니다.');
  if (data.theme !== 'dark' && data.theme !== 'light') throw new Error('지원하지 않는 테마입니다.');
  if (heroImageId && !/^[a-zA-Z0-9-]{1,80}$/.test(heroImageId)) throw new Error('이미지 ID가 올바르지 않습니다.');
  if (!Array.isArray(data.services) || data.services.length < 1 || data.services.length > 6 || data.services.some(s => typeof s !== 'string' || !s.trim() || s.length > 100)) throw new Error('서비스는 1~6개, 항목별 100자 이하로 입력해 주세요.');
  return {title, brand, headline, description, audience, referenceUrl, ctaLabel, accent,
    theme: data.theme, heroImageId, services: data.services.map(s => (s as string).trim())};
}
