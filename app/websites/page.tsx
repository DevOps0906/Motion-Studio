import RequirementsLinkButton from '../../components/RequirementsLinkButton';
import WebsiteProductCatalog from '../../components/WebsiteProductCatalog';
import './websites.css';
export default function WebsitesPage(){return <main className="website-builder website-product-page">
 <a className="requirements-entry-card" href="/website-requirements"><span className="requirements-entry-icon" aria-hidden="true">✓</span><div><span className="product-kicker">PROJECT REQUIREMENTS</span><h2>개발요구사항</h2><p>고객에게 보낼 체크형 진단 · 상품 추천 · 홈페이지형 블로그 선택 · 상담 접수</p></div><span className="button">요구사항 폼 열기</span></a>
 <div className="requirements-top-actions"><RequirementsLinkButton/></div>
 <div className="requirements-operator-link"><a href="/requirements-inbox">접수된 개발요구사항 확인</a> · <a href="/websites/inquiries">웹사이트 문의함</a></div>
 <header className="product-intro"><span className="product-kicker">WEBSITE COLLECTION</span><h1>지금의 비즈니스에 필요한<br/>다음 단계를 선택하세요.</h1><p>처음 신뢰를 만드는 일, 상담의 흐름을 정리하는 일, 브랜드를 경험하게 하는 일.<br/>페이지 수보다 고객이 홈페이지에서 하게 될 행동을 먼저 설계합니다.</p></header>
 <WebsiteProductCatalog/>
 <footer className="product-footnote"><p>가격·페이지·기간은 사업 초기 제안 기준입니다. 자료 확정과 범위 협의 후 견적을 확정합니다. 위 포함 범위는 상품별 계약 제안입니다. 현재 편집기는 한 페이지 HTML을 출력하며 CMS·CRM·GSAP 스크롤·자동화를 자동 구축하지 않습니다. 3D는 가져온 모델을 활용하며 신규 모델·도면 제작은 포함하지 않습니다.</p><a className="button" href="/websites/editor/basic">저장된 프로젝트 열기</a></footer>
 </main>;}
