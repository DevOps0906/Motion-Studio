'use client';
import {useEffect,useState} from 'react';
import {resolveWebsitePage, WEBSITE_SECTION_LABELS,type WebsiteBrief,type WebsitePage,type WebsitePageContent} from '../lib/website';
import type {MediaAsset} from '../lib/model';
import {suggestPageAddress} from '../lib/website-page-address';
import WebsiteGalleryEditor from './WebsiteGalleryEditor';

export default function WebsitePagesEditor({brief,activePageId,onSelect,onChange,onAdd,media,autoIds,onAutoIds}:{brief:WebsiteBrief;activePageId:string;onSelect:(id:string)=>void;onChange:(pages:WebsitePage[])=>void;onAdd:()=>void;media:MediaAsset[];autoIds:string[];onAutoIds:(ids:string[])=>void}) {
  const page=brief.pages.find(item=>item.id===activePageId);
  const [address,setAddress]=useState(activePageId),[error,setError]=useState('');
  useEffect(()=>{setAddress(activePageId);setError('');},[activePageId]);
  function update(patch:Partial<WebsitePage>){onChange(brief.pages.map(item=>item.id===activePageId?{...item,...patch}:item));}
  const content=resolveWebsitePage(brief,page);
  const ids=brief.pages.map(item=>item.id);
  const autoAddress=!!page&&autoIds.includes(page.id);
  const showEnglishHint=autoAddress&&!!page&&!!page.title.trim()&&page.title!=='새 페이지'&&!suggestPageAddress(page.title,ids,page.id).matched;
  function changeTitle(title:string){
    if(!page)return;
    if(autoAddress){const next=suggestPageAddress(title,ids,page.id);if(next.matched&&next.address!==page.id){update({title,id:next.address});onAutoIds(autoIds.map(id=>id===page.id?next.address:id));onSelect(next.address);setError('');return;}}
    update({title});
  }
  // Testimonials/FAQ/gallery keys are kept only if the page already has them (a missing key keeps following home); enabling copies everything.
  function copyContent(all=false):WebsitePageContent{
    const core={aboutHeading:content.aboutHeading,aboutBody:content.aboutBody,services:[...content.services],contactHeading:content.contactHeading,contactText:content.contactText,contactUrl:content.contactUrl,ctaLabel:content.ctaLabel};
    const source=all?content:page?.content;
    return {...core,...(source?.testimonialsHeading!==undefined?{testimonialsHeading:source.testimonialsHeading}:{}),...(source?.testimonials?{testimonials:source.testimonials.map(item=>({...item}))}:{}),...(source?.faqHeading!==undefined?{faqHeading:source.faqHeading}:{}),...(source?.faqs?{faqs:source.faqs.map(item=>({...item}))}:{}),...(source?.gallery?{gallery:source.gallery.map(item=>({...item}))}:{})};
  }
  function patchContent(patch:Partial<WebsitePageContent>){update({content:{...copyContent(),...patch}});}
  function rename(){
    if(!page||address===page.id)return;
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(address)||address.length>48||address==='index'||brief.pages.some(item=>item.id===address)){
      setError('주소는 중복 없이 영문 소문자·숫자·하이픈으로 입력하세요. index는 홈 전용입니다.');setAddress(page.id);return;
    }
    update({id:address});onAutoIds(autoIds.filter(id=>id!==page.id));onSelect(address);setError('');
  }
  function move(index:number,offset:number){
    if(!page)return;
    const sections=[...page.sections],next=index+offset;
    if(next<0||next>=sections.length)return;
    [sections[index],sections[next]]=[sections[next],sections[index]];update({sections});
  }
  return <div className="website-page-editor">
    <div className="section-head"><h3>사이트 페이지 · {brief.pages.length+1}/13</h3><button type="button" disabled={brief.pages.length>=12} onClick={onAdd}>＋ 페이지 추가</button></div>
    <div className="website-page-tabs"><button type="button" aria-pressed={activePageId==='index'} onClick={()=>onSelect('index')}>홈</button>{brief.pages.map(item=><button type="button" key={item.id} aria-pressed={activePageId===item.id} onClick={()=>onSelect(item.id)}>{item.title||'이름 없는 페이지'}</button>)}</div>
    {page?<div className="website-page-fields">
      <label>페이지 이름 <span className="required-mark" aria-hidden="true">*</span><input name="pageTitle" aria-required="true" value={page.title} maxLength={80} onChange={e=>changeTitle(e.target.value)}/></label>
      <label>페이지 주소<input value={address} maxLength={48} onChange={e=>{setAddress(e.target.value);setError('');}} onBlur={rename} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();rename();}}}/><small>영문 소문자·숫자·하이픈 · 입력 후 다른 항목을 누르면 적용됩니다.{autoAddress&&' 직접 바꾸기 전까지는 페이지 이름에 맞춰 자동으로 제안됩니다.'}</small>{showEnglishHint&&<small>영문 주소를 입력하면 링크가 더 읽기 쉬워집니다.</small>}</label>
      {error&&<p role="alert" className="error-text">{error}</p>}
      <label>첫 화면 제목 <span className="required-mark" aria-hidden="true">*</span><input name="pageHeadline" aria-required="true" value={page.headline} maxLength={160} onChange={e=>update({headline:e.target.value})}/></label>
      <label>페이지 소개<textarea value={page.description} maxLength={1200} rows={3} onChange={e=>update({description:e.target.value})}/></label>
      <label>이 페이지 대표 이미지<select value={page.heroImageId||''} onChange={e=>update({heroImageId:e.target.value||undefined})}><option value="">홈 대표 이미지 사용</option>{page.heroImageId&&!media.some(m=>m.id===page.heroImageId)&&<option value={page.heroImageId}>기존 이미지 · 목록 확인 필요</option>}{media.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
      <div className="website-section-editor"><h4>이 페이지의 섹션</h4><p className="small">표시와 순서는 페이지별로 저장됩니다. 디자인은 사이트 전체가 공유하고, 상세 문구는 이 페이지에서 별도로 설정할 수 있습니다.</p><ol>{page.sections.map((section,index)=><li key={section.id}><label className="check"><input type="checkbox" checked={section.enabled} onChange={e=>update({sections:page.sections.map(item=>item.id===section.id?{...item,enabled:e.target.checked}:item)})}/>{WEBSITE_SECTION_LABELS[section.id]}</label><div className="actions"><button type="button" disabled={index===0} aria-label={`${WEBSITE_SECTION_LABELS[section.id]} 위로`} onClick={()=>move(index,-1)}>↑</button><button type="button" disabled={index===page.sections.length-1} aria-label={`${WEBSITE_SECTION_LABELS[section.id]} 아래로`} onClick={()=>move(index,1)}>↓</button></div></li>)}</ol></div>
      <label className="check"><input type="checkbox" checked={!!page.content} onChange={e=>update({content:e.target.checked?copyContent(true):undefined})}/>이 페이지의 상세 문구를 별도로 편집</label>
      {page.content?<div className="website-page-fields">
        <label>소개 제목<input value={content.aboutHeading} maxLength={120} onChange={e=>update({content:{...copyContent(),aboutHeading:e.target.value}})}/></label>
        <label>소개 본문 · 비우면 이 페이지 소개 사용<textarea value={content.aboutBody} rows={4} maxLength={1200} onChange={e=>update({content:{...copyContent(),aboutBody:e.target.value}})}/></label>
        <label>서비스 <span className="required-mark" aria-hidden="true">*</span> · 한 줄에 하나, 최대 6개<textarea name="pageServices" aria-required="true" value={content.services.join('\n')} rows={4} onChange={e=>update({content:{...copyContent(),services:e.target.value.split('\n')}})}/></label>
        <label>문의 제목<input value={content.contactHeading} maxLength={120} onChange={e=>update({content:{...copyContent(),contactHeading:e.target.value}})}/></label>
        <label>문의 안내<textarea value={content.contactText} rows={3} maxLength={1200} onChange={e=>update({content:{...copyContent(),contactText:e.target.value}})}/></label>
        <label>문의 링크<input type="url" name="pageContactUrl" value={content.contactUrl} maxLength={2000} onChange={e=>update({content:{...copyContent(),contactUrl:e.target.value}})}/></label>
        <label>버튼 문구 <span className="required-mark" aria-hidden="true">*</span><input name="pageCtaLabel" aria-required="true" value={content.ctaLabel} maxLength={40} onChange={e=>update({content:{...copyContent(),ctaLabel:e.target.value}})}/></label>
        <div className="website-section-fields"><h4>고객 후기</h4><p className="small">이 페이지에서 고친 순간부터 홈의 후기와 따로 저장됩니다. 빈 후기는 저장할 때 제외됩니다.</p>
          <label>후기 제목<input maxLength={120} value={content.testimonialsHeading} onChange={e=>patchContent({testimonialsHeading:e.target.value})}/></label>
          {content.testimonials.map((item,index)=><fieldset key={index}><legend>후기 {index+1}</legend><label>후기 내용<textarea rows={3} maxLength={300} value={item.quote} onChange={e=>patchContent({testimonials:content.testimonials.map((value,i)=>i===index?{...value,quote:e.target.value}:value)})}/></label><label>작성자 · 선택<input maxLength={300} value={item.name} onChange={e=>patchContent({testimonials:content.testimonials.map((value,i)=>i===index?{...value,name:e.target.value}:value)})}/></label><button type="button" onClick={()=>patchContent({testimonials:content.testimonials.filter((_,i)=>i!==index)})}>이 후기 삭제</button></fieldset>)}
          <button type="button" disabled={content.testimonials.length>=6} onClick={()=>patchContent({testimonials:[...content.testimonials,{quote:'',name:''}]})}>＋ 후기 추가 · 최대 6개</button></div>
        <div className="website-section-fields"><h4>자주 묻는 질문</h4><p className="small">이 페이지에서 고친 순간부터 홈의 FAQ와 따로 저장됩니다. 빈 질문은 저장할 때 제외됩니다.</p>
          <label>FAQ 제목<input maxLength={120} value={content.faqHeading} onChange={e=>patchContent({faqHeading:e.target.value})}/></label>
          {content.faqs.map((item,index)=><fieldset key={index}><legend>질문 {index+1}</legend><label>질문<input maxLength={300} value={item.question} onChange={e=>patchContent({faqs:content.faqs.map((value,i)=>i===index?{...value,question:e.target.value}:value)})}/></label><label>답변<textarea rows={3} maxLength={300} value={item.answer} onChange={e=>patchContent({faqs:content.faqs.map((value,i)=>i===index?{...value,answer:e.target.value}:value)})}/></label><button type="button" onClick={()=>patchContent({faqs:content.faqs.filter((_,i)=>i!==index)})}>이 질문 삭제</button></fieldset>)}
          <button type="button" disabled={content.faqs.length>=8} onClick={()=>patchContent({faqs:[...content.faqs,{question:'',answer:''}]})}>＋ 질문 추가 · 최대 8개</button></div>
        <div className="website-section-fields"><h4>갤러리</h4><p className="small">이 페이지에서 고친 순간부터 홈의 갤러리와 따로 저장됩니다.</p>
          <WebsiteGalleryEditor items={content.gallery} media={media} onChange={gallery=>patchContent({gallery})}/></div>
        <p className="small">별도 편집을 끄면 이 페이지의 상세 문구가 제거되고 홈의 최신 내용을 따릅니다.</p>
      </div>:<p className="small">소개·서비스·문의·후기·FAQ·갤러리 상세 문구는 홈의 브랜드 정보를 따릅니다. 별도 편집을 켜면 현재 내용을 복사합니다.</p>}
      <button type="button" onClick={()=>{if(!window.confirm(`'${page.title}' 페이지를 삭제할까요?`))return;onChange(brief.pages.filter(item=>item.id!==activePageId));onSelect('index');}}>이 페이지 삭제</button>
    </div>:<p className="small">홈은 아래 브랜드 브리프에서 편집합니다. 추가 페이지는 전역 디자인을 공유하며 페이지별 제목·소개·섹션 구성을 설정할 수 있습니다.</p>}
  </div>;
}
