import type {CSSProperties} from 'react';
import type {WebsiteBrief} from '../lib/website';

export default function WebsitePreview({brief}: {brief: WebsiteBrief}) {
  return <article className={`website-preview website-theme-${brief.theme}`} style={{'--site-accent': brief.accent} as CSSProperties}>
    <header className="website-nav"><strong>{brief.brand || 'YOUR BRAND'}</strong><span>BRAND EXPERIENCE</span></header>
    <section className="website-hero">
      <div><div className="website-eyebrow">{brief.audience || '당신의 고객을 위한 새로운 경험'}</div>
        <h1>{brief.headline || '브랜드의 다음 장면을 만드세요.'}</h1>
        <p>{brief.description || '브랜드 소개를 입력하면 이곳에 표시됩니다. 핵심 가치와 고객에게 전할 이야기를 작성해 보세요.'}</p>
        <a className="website-cta" href="#website-services">{brief.ctaLabel || '브랜드 알아보기'} <span aria-hidden="true">↗</span></a>
      </div>
      {brief.heroImageId ? <img className="website-cover" src={`/api/media/${encodeURIComponent(brief.heroImageId)}`} alt={`${brief.brand || '브랜드'} 대표 이미지`}/> :
        <div className="website-art" aria-hidden="true"><div/><span>{brief.brand || 'MOTION'}</span><small>SHAPE YOUR NEXT CHAPTER</small></div>}
    </section>
    <section id="website-services" className="website-services"><div className="website-eyebrow">WHAT WE DO</div><h2>우리가 만드는 가치</h2>
      <div className="website-service-grid">{brief.services.filter(s => s.trim()).map((service, i) => <article key={i}><span>{String(i + 1).padStart(2, '0')}</span><h3>{service}</h3></article>)}</div>
    </section>
    <footer className="website-footer"><strong>{brief.brand || 'YOUR BRAND'}</strong><span>{brief.title || '브랜드 랜딩 페이지'}</span></footer>
  </article>;
}
