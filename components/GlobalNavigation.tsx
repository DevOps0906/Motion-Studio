'use client';
import {usePathname,useSearchParams} from 'next/navigation';
const groups = [
  {label:'워크스페이스',items:[
    {href:'/studio',label:'대시보드',icon:'▦',view:'dashboard'},
    {href:'/studio?view=projects',label:'영상 프로젝트',icon:'▣',view:'projects'},
    {href:'/studio?view=media',label:'미디어 라이브러리',icon:'▧',view:'media'},
    {href:'/studio?view=templates',label:'모션 프리셋',icon:'◇',view:'templates'},
    {href:'/studio?view=renders',label:'렌더 작업',icon:'▷',view:'renders'},
  ]},
  {label:'제작 공간',items:[
    {href:'/websites',label:'웹사이트 제작기',icon:'W'},
    {href:'/blog-skins',label:'네이버 블로그 스킨',icon:'B'},
    {href:'/gallery',label:'3D 갤러리',icon:'◈'},
    {href:'/architecture/viewer',label:'모델 뷰어',icon:'⌂'},
    {href:'/showcase',label:'랜딩 모션 데모',icon:'↗'},
    {href:'/intro',label:'인트로 미리보기',icon:'▶'},
  ]},
  {label:'출력·안내',items:[
    {href:'/references',label:'레퍼런스 라이브러리',icon:'⌕'},
    {href:'/exports',label:'CapCut 내보내기',icon:'⇩'},
    {href:'/architecture',label:'제작 구조도',icon:'▤'},
  ]},
];
export default function GlobalNavigation(){
  const path=usePathname(),params=useSearchParams();
  function active(item:{href:string;view?:string}){
    if(item.view){if(path.startsWith('/studio/projects/'))return item.view==='projects';return path==='/studio'&&(params.get('view')||'dashboard')===item.view;}
    if(item.href==='/architecture')return path==='/architecture';
    return path===item.href||path.startsWith(item.href+'/');
  }
  return <aside className="app-gnb"><a className="brand" href="/studio" aria-label="Motion Studio 대시보드"><span className="brandmark" aria-hidden="true"><i/><i/><i/><i/></span><span className="gnb-brand-text">MOTION<small>STUDIO</small></span></a>
    <nav aria-label="전체 메뉴">{groups.map(group=><div className="gnb-group" key={group.label}><div className="gnb-group-label">{group.label}</div>{group.items.map(item=><a key={item.href} href={item.href} aria-label={item.label} title={item.label} aria-current={active(item)?'page':undefined}><span className="gnb-icon" aria-hidden="true">{item.icon}</span><span className="gnb-item-label">{item.label}</span></a>)}</div>)}</nav>
    <div className="gnb-local"><span className="dot"/><span>이 PC의 제작 도구</span><p>사진·프로젝트를 로컬에 저장합니다.</p></div>
  </aside>;
}
