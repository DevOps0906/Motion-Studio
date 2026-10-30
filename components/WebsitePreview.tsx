import type {CSSProperties} from 'react';
import {websiteCtaHref, safeWebsiteLink, type WebsiteBrief} from '../lib/website';
import {WEBSITE_PREVIEW_CSS} from '../lib/website-styles';

export default function WebsitePreview({brief}: {brief: WebsiteBrief}) {
  const ctaHref = websiteCtaHref(brief);
  const contactHref = safeWebsiteLink(brief.contactUrl);
  return <article className={`website-preview website-theme-${brief.theme} website-design-${brief.designPreset} website-kit-${brief.designKit || 'original'}`} style={{'--site-accent': brief.accent} as CSSProperties}>
    <style>{WEBSITE_PREVIEW_CSS}</style>
    <header className="website-nav"><strong>{brief.brand || 'YOUR BRAND'}</strong><span>BRAND EXPERIENCE</span></header>
    <section className="website-hero">
      <div><div className="website-eyebrow">{brief.audience || '당신의 고객을 위한 새로운 경험'}</div>
        <h1>{brief.headline || '브랜드의 다음 장면을 만드세요.'}</h1>
        <p>{brief.description || '브랜드 소개를 입력하면 이곳에 표시됩니다. 핵심 가치와 고객에게 전할 이야기를 작성해 보세요.'}</p>
        {ctaHref && <a className="website-cta" href={ctaHref}>{brief.ctaLabel || '브랜드 알아보기'} <span aria-hidden="true">↗</span></a>}
      </div>
      {brief.heroImageId ? <img className="website-cover" src={`/api/media/${encodeURIComponent(brief.heroImageId)}`} alt={`${brief.brand || '브랜드'} 대표 이미지`}/> :
        <div className="website-art" aria-hidden="true"><div/><span>{brief.brand || 'MOTION'}</span><small>SHAPE YOUR NEXT CHAPTER</small></div>}
    </section>
    {brief.sections.filter(section => section.enabled).map(section => {
      if (section.id === 'about') return <section key={section.id} id="website-about" className="website-content-section" data-website-section="about"><div className="website-eyebrow">OUR STORY</div><h2>{brief.aboutHeading || '우리의 이야기'}</h2><p>{brief.aboutBody || brief.description || '브랜드가 전하고 싶은 이야기를 소개해 주세요.'}</p></section>;
      if (section.id === 'contact') return <section key={section.id} id="website-contact" className="website-content-section website-contact" data-website-section="contact"><div className="website-eyebrow">NEXT CHAPTER</div><h2>{brief.contactHeading || '함께 다음 장면을 만드세요.'}</h2>{brief.contactText && <p>{brief.contactText}</p>}{contactHref && <a className="website-cta" href={contactHref}>{brief.ctaLabel || '브랜드 알아보기'} <span aria-hidden="true">↗</span></a>}</section>;
      return <section key={section.id} id="website-services" className="website-services" data-website-section="services"><div className="website-eyebrow">WHAT WE DO</div><h2>우리가 만드는 가치</h2>
        <div className="website-service-grid">{brief.services.filter(s => s.trim()).map((service, i) => <article key={i}><span>{String(i + 1).padStart(2, '0')}</span><h3>{service}</h3></article>)}</div>
      </section>;
    })}
    <footer className="website-footer"><strong>{brief.brand || 'YOUR BRAND'}</strong><span>{brief.title || '브랜드 랜딩 페이지'}</span></footer>
  </article>;
}
