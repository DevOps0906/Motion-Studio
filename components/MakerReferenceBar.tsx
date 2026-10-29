'use client';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import ReferenceLibrary from './ReferenceLibrary';
export default function MakerReferenceBar(){
 const path=usePathname(),[selected,setSelected]=useState('');
 useEffect(()=>{try{setSelected(JSON.parse(localStorage.getItem('motion-studio-reference:'+path)||'null')?.title||'');}catch{setSelected('');}
  const choose=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!detail?.url||!detail?.title)return;localStorage.setItem('motion-studio-reference:'+path,JSON.stringify(detail));setSelected(detail.title);};
  window.addEventListener('motion-reference-selected',choose);return()=>window.removeEventListener('motion-reference-selected',choose);
 },[path]);
 const category=path.startsWith('/websites')||path.startsWith('/blog-skins')?'web':path.startsWith('/architecture/viewer')||path==='/gallery'?'threeD':path.startsWith('/studio')||path.startsWith('/intro')?'templates':'all';
 return <div className="maker-reference-bar"><details><summary>⌕ 레퍼런스 찾기 · 분야/유형/기술 필터{selected&&<span className="reference-current">선택: {selected}</span>}</summary><ReferenceLibrary key={path} compact initialCategory={category}/></details></div>;
}
