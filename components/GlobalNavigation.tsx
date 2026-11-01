'use client';
import {usePathname,useSearchParams} from 'next/navigation';
import {useEffect,useState} from 'react';
const groups = [
  {label:'워크스페이스',items:[
    {href:'/studio?view=dashboard',label:'대시보드',icon:'▦',view:'dashboard'},
    {href:'/studio?view=projects',label:'영상 프로젝트',icon:'▣',view:'projects'},
    {href:'/studio?view=media',label:'미디어 라이브러리',icon:'▧',view:'media'},
    {href:'/studio?view=templates',label:'모션 프리셋',icon:'◇',view:'templates'},
    {href:'/studio?view=renders',label:'렌더 작업',icon:'▷',view:'renders'},
  ]},
  {label:'제작 공간',items:[
    {href:'/websites',label:'웹사이트 제작기',icon:'W'},
    {href:'/blog-skins',label:'홈페이지형 블로그 디자인',icon:'B'},
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
  const [unread,setUnread]=useState(0);
  // Operators only: the API answers 403 for everyone else, so the badge stays hidden.
  useEffect(()=>{let live=true;const refresh=()=>{fetch('/api/inquiries/unread',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(data=>{if(live&&typeof data?.count==='number')setUnread(data.count);}).catch(()=>{});};refresh();window.addEventListener('inquiries-changed',refresh);return ()=>{live=false;window.removeEventListener('inquiries-changed',refresh);};},[path]);
  function active(item:{href:string;view?:string}){
    if(item.view){if(path.startsWith('/studio/projects/'))return item.view==='projects';return path==='/studio'&&(params.get('view')||'dashboard')===item.view;}
    if(item.href==='/architecture')return path==='/architecture';
    return path===item.href||path.startsWith(item.href+'/');
  }
  return <aside className="app-gnb"><a className="brand" href="/" aria-label="Motion Studio 랜딩페이지"><span className="brandmark" aria-hidden="true"><i/><i/><i/><i/></span><span className="gnb-brand-text">MOTION<small>STUDIO</small></span></a>
    <nav aria-label="전체 메뉴">{groups.map(group=><div className="gnb-group" key={group.label}><div className="gnb-group-label">{group.label}</div>{group.items.map(item=>{const badge=item.href==='/websites'&&unread>0;const label=badge?`${item.label} · 안 읽은 문의 ${unread}건`:item.label;return <a key={item.href} href={item.href} aria-label={label} title={label} aria-current={active(item)?'page':undefined}><span className="gnb-icon" aria-hidden="true">{item.icon}</span><span className="gnb-item-label">{item.label}</span>{badge&&<span className="gnb-badge" aria-hidden="true" style={{marginLeft:'auto',minWidth:20,padding:'0 6px',borderRadius:10,background:'var(--accent)',color:'var(--bg)',fontSize:11,fontWeight:700,lineHeight:'20px',textAlign:'center'}}>{unread>99?'99+':unread}</span>}</a>;})}</div>)}</nav>
    <div className="gnb-footer"><a className="gnb-settings" href="/settings" aria-label="환경설정" title="환경설정" aria-current={path==='/settings'?'page':undefined}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M9 3h6l.7 2.7 2.6 1 2.4 1.8-2 4 .3 2.7-2 3-2.8-.1L12 21l-2.2-2.9-2.8.1-2-3 .3-2.7-2-4 2.4-1.8 2.6-1L9 3Z"/><circle cx="12" cy="12" r="3"/></svg><span className="gnb-item-label">환경설정</span></a><div className="gnb-local"><span className="dot"/><span>이 PC의 제작 도구</span><p>사진·프로젝트를 로컬에 저장합니다.</p></div></div>
  </aside>;
}
