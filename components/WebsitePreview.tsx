'use client';
import type {CSSProperties} from 'react';
import {resolveWebsitePage, websiteCtaHref, safeWebsiteLink, type WebsiteBrief, type WebsitePage} from '../lib/website';
import {WEBSITE_PREVIEW_CSS} from '../lib/website-styles';

export default function WebsitePreview({brief,page,onNavigate,previewBase}: {brief: WebsiteBrief;page?:WebsitePage;onNavigate?:(id:string)=>void;previewBase?:string}) {
  const current = resolveWebsitePage(brief,page);
  const ctaHref = websiteCtaHref(current);
  const contactHref = safeWebsiteLink(current.contactUrl);
  return <article className={`website-preview website-theme-${current.theme} website-design-${current.designPreset} website-kit-${current.designKit || 'original'}`} style={{'--site-accent': current.accent} as CSSProperties}>
    <style>{WEBSITE_PREVIEW_CSS}</style>
    <header className="website-nav"><strong>{current.brand || 'YOUR BRAND'}</strong><nav aria-label="사이트 페이지">{[{id:'index',title:'HOME'},...brief.pages].map(item=><a key={item.id} aria-current={(page?.id||'index')===item.id?'page':undefined} href={previewBase ? previewBase+(item.id==='index'?'':'?page='+encodeURIComponent(item.id)) : '#'} onClick={onNavigate?event=>{event.preventDefault();onNavigate(item.id);}:event=>{if(!previewBase)event.preventDefault();}}>{item.title}</a>)}</nav></header>
    <section className="website-hero">
      <div><div className="website-eyebrow">{current.audience || '당신의 고객을 위한 새로운 경험'}</div>
        <h1>{current.headline || '브랜드의 다음 장면을 만드세요.'}</h1>
        <p>{current.description || '브랜드 소개를 입력하면 이곳에 표시됩니다. 핵심 가치와 고객에게 전할 이야기를 작성해 보세요.'}</p>
        {ctaHref && <a className="website-cta" href={ctaHref}>{current.ctaLabel || '브랜드 알아보기'} <span aria-hidden="true">↗</span></a>}
      </div>
      {current.heroImageId ? <img className="website-cover" src={`/api/media/${encodeURIComponent(current.heroImageId)}`} alt={`${current.brand || '브랜드'} 대표 이미지`}/> :
        <div className="website-art" aria-hidden="true"><div/><span>{current.brand || 'MOTION'}</span><small>SHAPE YOUR NEXT CHAPTER</small></div>}
    </section>
    {current.sections.filter(section => section.enabled).map(section => {
      if (section.id === 'about') return <section key={section.id} id="website-about" className="website-content-section" data-website-section="about"><div className="website-eyebrow">OUR STORY</div><h2>{current.aboutHeading || '우리의 이야기'}</h2><p>{current.aboutBody || current.description || '브랜드가 전하고 싶은 이야기를 소개해 주세요.'}</p></section>;
      if (section.id === 'testimonials') return !current.testimonials.length ? null : <section key={section.id} id="website-testimonials" className="website-content-section" data-website-section="testimonials"><div className="website-eyebrow">VOICES</div><h2>{current.testimonialsHeading || '고객 후기'}</h2>
        <div className="website-service-grid">{current.testimonials.map((item, i) => <article key={i}><p>{item.quote}</p>{item.name && <span>{item.name}</span>}</article>)}</div></section>;
      if (section.id === 'faq') return !current.faqs.length ? null : <section key={section.id} id="website-faq" className="website-content-section" data-website-section="faq"><div className="website-eyebrow">FAQ</div><h2>{current.faqHeading || '자주 묻는 질문'}</h2>
        <dl className="website-faq-list">{current.faqs.map((item, i) => <div key={i}><dt>{item.question}</dt><dd>{item.answer}</dd></div>)}</dl></section>;
      if (section.id === 'contact') return <section key={section.id} id="website-contact" className="website-content-section website-contact" data-website-section="contact"><div className="website-eyebrow">NEXT CHAPTER</div><h2>{current.contactHeading || '함께 다음 장면을 만드세요.'}</h2>{current.contactText && <p>{current.contactText}</p>}{contactHref && <a className="website-cta" href={contactHref}>{current.ctaLabel || '브랜드 알아보기'} <span aria-hidden="true">↗</span></a>}</section>;
      return <section key={section.id} id="website-services" className="website-services" data-website-section="services"><div className="website-eyebrow">WHAT WE DO</div><h2>우리가 만드는 가치</h2>
        <div className="website-service-grid">{current.services.filter(s => s.trim()).map((service, i) => <article key={i}><span>{String(i + 1).padStart(2, '0')}</span><h3>{service}</h3></article>)}</div>
      </section>;
    })}
    <footer className="website-footer"><strong>{current.brand || 'YOUR BRAND'}</strong><span>{current.title || '브랜드 랜딩 페이지'}</span></footer>
  </article>;
}
