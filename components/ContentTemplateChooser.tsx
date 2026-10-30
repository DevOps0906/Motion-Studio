'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import dynamic from 'next/dynamic';
import {CONTENT_TEMPLATES} from '../lib/content-template-data';
import {newContentProject} from '../lib/content-templates';
import type {MediaAsset} from '../lib/model';
const Scene=dynamic(()=>import('./ContentScene'),{ssr:false});
const categories=[
 {id:'ranking-short',name:'랭킹형 쇼츠',description:'순위·사진·설명으로 만드는 세로 영상',tone:'blue',format:'9:16'},
 {id:'captioned-video',name:'자동 자막 배치',description:'입력한 문장을 리듬에 맞춰 배치하는 세로 영상',tone:'violet',format:'9:16'},
 {id:'product-comparison',name:'제품 비교 영상',description:'두 제품의 정보와 출처를 비교하는 가로 영상',tone:'gold',format:'16:9'},
] as const;
type Category=typeof categories[number];
function TemplateSelectionModal({category,media,onClose}:{category:Category;media:MediaAsset[];onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const prior=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;dialog.current?.showModal();document.body.style.overflow='hidden';return()=>{dialog.current?.close();document.body.style.overflow=overflow;prior?.focus();};},[]);
 const choices=CONTENT_TEMPLATES.filter(item=>item.category===category.id),photos=media.filter(item=>item.type==='image'&&item.role!=='source-capture').slice(0,3).map(item=>item.id);
 return <dialog ref={dialog} className="content-choice-modal" aria-labelledby="content-choice-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onClose();}}}>
 <header><div><span className="eyebrow">CHOOSE A TEMPLATE</span><h2 id="content-choice-title">{category.name} 템플릿 선택</h2><p>3가지 스타일 중 하나를 선택해 편집을 시작하세요.</p></div><button type="button" aria-label="템플릿 선택 닫기" onClick={onClose}>×</button></header>
 <div className="content-choice-grid">{choices.map((item,index)=>{const project={...newContentProject(item.id),photos};return <article className={`content-choice-card choice-tone-${['blue','violet','gold'][index]}`} key={item.id}><div className="content-choice-preview" aria-hidden="true"><div style={{position:'relative',height:'100%',aspectRatio:item.aspect==='9:16'?'9 / 16':'16 / 9',maxWidth:'100%'} as CSSProperties}><Scene project={project} media={media} time={2}/></div></div><span className="content-choice-number">STYLE {String(index+1).padStart(2,'0')}</span><h3>{item.name}</h3><p>{item.description}</p><small>{item.aspect} · 기본 15초 · 편집 가능</small><a className="button" href={`/content/${item.id}`}>{item.name} 사용</a></article>;})}</div>
 {category.id==='captioned-video'&&<p className="content-choice-note">입력 문장 자동 배치 템플릿입니다. 음성 인식·전사 기능은 연결되지 않았습니다.</p>}
 </dialog>;
}
export default function ContentTemplateChooser({media}:{media:MediaAsset[]}){
 const [category,setCategory]=useState<Category|null>(null);
 return <>{categories.map(item=><article className={`catalog-card content-category-card choice-tone-${item.tone}`} data-content-category={item.id} key={item.id}><span className="content-choice-number">{item.format} · 3 TEMPLATES</span><h3>{item.name}</h3><p>{item.description}</p><button type="button" aria-haspopup="dialog" onClick={()=>setCategory(item)}>템플릿 사용</button></article>)}{category&&<TemplateSelectionModal category={category} media={media} onClose={()=>setCategory(null)}/>}</>;
}
