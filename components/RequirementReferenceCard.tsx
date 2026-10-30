import {REQUIREMENT_REFERENCE_CARDS,requirementReferenceHref} from '../lib/website-reference-showcase';
export default function RequirementReferenceCard({tier}:{tier:'basic'|'business'|'premium'}){
 const item=REQUIREMENT_REFERENCE_CARDS.find(card=>card.tier===tier)!;
 const href=requirementReferenceHref(item.url);
 const content=<><div className="requirement-reference-preview" aria-hidden="true"><span/><div/><i/><i/><i/></div><span className="requirement-reference-category">{item.title}</span><p>{item.description}</p><strong>{href?'레퍼런스 사이트 열기':'레퍼런스 준비 중'}</strong></>;
 return <aside className="requirement-reference" aria-label={`${item.tier.toUpperCase()} 홈페이지 레퍼런스`}>{href?<a href={href} target="_blank" rel="noopener noreferrer" className="requirement-reference-card">{content}</a>:<div className="requirement-reference-card is-pending" aria-disabled="true">{content}</div>}</aside>;
}
