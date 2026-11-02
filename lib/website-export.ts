import {resolveWebsitePage, validateWebsiteBrief, visibleGallery, websiteCtaHref, type WebsiteBrief, type WebsitePage} from './website';
import {WEBSITE_PREVIEW_CSS} from './website-styles';

function escape(value: string) {
  return value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]!));
}

// Image sources are either an inlined raster data URL (single HTML) or a relative assets/ file (ZIP). No local API URLs survive export.
const IMAGE_SRC = /^(?:data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*|\.\/assets\/[A-Za-z0-9-]{1,80}\.(?:png|jpg|webp))$/;
// galleryImages maps imageId to its source; ids without one (deleted media) are skipped.
export function exportWebsiteHtml(input: WebsiteBrief, imageDataUrl = '', page?: WebsitePage, galleryImages: Record<string, string> = {}) {
  const base = validateWebsiteBrief(input);
  const validPage=page?base.pages.find(item=>item.id===page.id):undefined;
  if(page&&!validPage)throw new Error('출력할 페이지를 찾을 수 없습니다.');
  const brief = resolveWebsitePage(base,validPage);
  if (brief.heroImageId && !IMAGE_SRC.test(imageDataUrl)) throw new Error('내보낼 대표 이미지를 확인해 주세요.');
  const e = escape;
  const cta = (href: string) => href ? `<a class="website-cta" href="${e(href)}">${e(brief.ctaLabel)} <span aria-hidden="true">↗</span></a>` : '';
  const available = new Set(Object.keys(galleryImages));
  const gallery = visibleGallery(brief, available);
  if (gallery.some(item => !IMAGE_SRC.test(galleryImages[item.imageId]))) throw new Error('내보낼 갤러리 이미지를 확인해 주세요.');
  const sections = brief.sections.filter(section => section.enabled).map(section => {
    if (section.id === 'about') return `<section id="website-about" class="website-content-section" data-website-section="about"><div class="website-eyebrow">OUR STORY</div><h2>${e(brief.aboutHeading || '우리의 이야기')}</h2><p>${e(brief.aboutBody || brief.description)}</p></section>`;
    if (section.id === 'testimonials') return !brief.testimonials.length ? '' : `<section id="website-testimonials" class="website-content-section" data-website-section="testimonials"><div class="website-eyebrow">VOICES</div><h2>${e(brief.testimonialsHeading || '고객 후기')}</h2><div class="website-service-grid">${brief.testimonials.map(item => `<article><p>${e(item.quote)}</p>${item.name ? `<span>${e(item.name)}</span>` : ''}</article>`).join('')}</div></section>`;
    if (section.id === 'faq') return !brief.faqs.length ? '' : `<section id="website-faq" class="website-content-section" data-website-section="faq"><div class="website-eyebrow">FAQ</div><h2>${e(brief.faqHeading || '자주 묻는 질문')}</h2><dl class="website-faq-list">${brief.faqs.map(item => `<div><dt>${e(item.question)}</dt><dd>${e(item.answer)}</dd></div>`).join('')}</dl></section>`;
    if (section.id === 'gallery') return !gallery.length ? '' : `<section id="website-gallery" class="website-content-section website-gallery" data-website-section="gallery"><div class="website-eyebrow">GALLERY</div><h2>갤러리</h2><ul class="website-gallery-grid">${gallery.map(item => `<li><figure><img src="${galleryImages[item.imageId]}" alt="${e(item.alt)}" loading="lazy">${item.caption ? `<figcaption>${e(item.caption)}</figcaption>` : ''}</figure></li>`).join('')}</ul></section>`;
    if (section.id === 'contact') return `<section id="website-contact" class="website-content-section website-contact" data-website-section="contact"><div class="website-eyebrow">NEXT CHAPTER</div><h2>${e(brief.contactHeading || '함께 다음 장면을 만드세요.')}</h2>${brief.contactText ? `<p>${e(brief.contactText)}</p>` : ''}${cta(brief.contactUrl)}</section>`;
    return `<section id="website-services" class="website-services" data-website-section="services"><div class="website-eyebrow">WHAT WE DO</div><h2>우리가 만드는 가치</h2><div class="website-service-grid">${brief.services.map((service, i) => `<article><span>${String(i + 1).padStart(2, '0')}</span><h3>${e(service)}</h3></article>`).join('')}</div></section>`;
  }).join('\n');
  const cover = brief.heroImageId ? `<img class="website-cover" src="${imageDataUrl}" alt="${e(brief.brand)} 대표 이미지">` : `<div class="website-art" aria-hidden="true"><div></div><span>${e(brief.brand)}</span><small>SHAPE YOUR NEXT CHAPTER</small></div>`;
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${e(brief.title)}</title><meta name="description" content="${e(brief.description)}"><style>body{margin:0;background:${brief.theme === 'dark' ? '#10131c' : '#faf9f6'}}.website-export-frame{container-type:inline-size;max-width:1600px;margin:auto}${WEBSITE_PREVIEW_CSS}</style></head>
<body><main class="website-export-frame"><article class="website-preview website-theme-${brief.theme} website-design-${brief.designPreset} website-kit-${brief.designKit}" style="--site-accent:${brief.accent}">
<header class="website-nav"><strong>${e(brief.brand)}</strong><nav aria-label="사이트 페이지"><a href="${base.pages.length ? './index.html' : '#'}"${!page?' aria-current="page"':''}>HOME</a>${base.pages.map(item=>`<a href="./${e(item.id)}.html"${page?.id===item.id?' aria-current="page"':''}>${e(item.title)}</a>`).join('')}</nav></header>
<section class="website-hero"><div><div class="website-eyebrow">${e(brief.audience || '당신의 고객을 위한 새로운 경험')}</div><h1>${e(brief.headline)}</h1><p>${e(brief.description)}</p>${cta(websiteCtaHref(brief))}</div>${cover}</section>
${sections}
<footer class="website-footer"><strong>${e(brief.brand)}</strong><span>${e(brief.title)}</span></footer>
</article></main></body></html>`;
}
