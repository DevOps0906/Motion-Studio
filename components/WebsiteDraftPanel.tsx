'use client';
import {useEffect,useState} from 'react';
import type {WebsiteBrief} from '../lib/website';
import {applyWebsiteDraft,undoWebsiteDraft,websiteDraftChanges,WEBSITE_DRAFT_FIELD_LABELS,type WebsiteDraft,type WebsiteDraftMode} from '../lib/website-draft';

type DraftResult={draft:WebsiteDraft;provider:'automatic'|'openai';warnings:string[]};
export default function WebsiteDraftPanel({brief,disabled,onChange}:{brief:WebsiteBrief;disabled:boolean;onChange:(brief:WebsiteBrief,message:string)=>void}){
  const [aiAvailable,setAiAvailable]=useState(false),[useAi,setUseAi]=useState(false);
  const [status,setStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle'),[error,setError]=useState('');
  const [result,setResult]=useState<DraftResult|null>(null),[mode,setMode]=useState<WebsiteDraftMode>('fill');
  const [previous,setPrevious]=useState<Partial<WebsiteDraft>|null>(null);
  useEffect(()=>{fetch('/api/websites/draft',{cache:'no-store'}).then(response=>response.ok?response.json():{aiAvailable:false}).then(body=>setAiAvailable(body.aiAvailable===true)).catch(()=>setAiAvailable(false));},[]);
  async function generate(){
    setStatus('loading');setError('');setResult(null);
    try{
      const response=await fetch('/api/websites/draft',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({brief,useAi:aiAvailable&&useAi})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'초안을 만들지 못했습니다.');
      setResult(body as DraftResult);setStatus('ready');
    }catch(cause){setError(cause instanceof Error?cause.message:'초안을 만들지 못했습니다.');setStatus('error');}
  }
  const changes=result?websiteDraftChanges(brief,result.draft,mode):[];
  function apply(){
    if(!result)return;const applied=applyWebsiteDraft(brief,result.draft,mode);
    setPrevious(applied.previous);setResult(null);setStatus('idle');
    onChange(applied.brief,applied.changed.length?`초안을 적용했습니다(${applied.changed.map(field=>WEBSITE_DRAFT_FIELD_LABELS[field]).join(', ')}). 확인 후 저장해 주세요.`:'바뀌는 항목이 없어 그대로 두었습니다.');
  }
  function undo(){if(!previous)return;onChange(undoWebsiteDraft(brief,previous),'초안 적용 전 내용으로 되돌렸습니다. 확인 후 저장해 주세요.');setPrevious(null);}
  return <div className="website-section-fields website-draft-panel">
    <h3>홈 초안 생성</h3>
    <p className="small">입력한 브리프만으로 홈의 핵심 문구·소개·서비스·버튼 문구·섹션 표시를 제안합니다. 후기·FAQ·문의 정보·이미지·추가 페이지는 바꾸지 않으며, 레퍼런스는 분류 기반 방향 제안으로만 씁니다.</p>
    {aiAvailable&&<><label className="check"><input type="checkbox" checked={useAi} disabled={disabled||status==='loading'} onChange={e=>setUseAi(e.target.checked)}/>AI 초안 사용</label><p className="small">AI 사용 시 브랜드명·브랜드 소개·대상 고객·서비스·업종·목표·제공 내용·레퍼런스 제목·디자인 방향이 OpenAI로 전송됩니다(저장 안 함).</p></>}
    <div className="actions"><button type="button" disabled={disabled||status==='loading'} onClick={()=>void generate()}>{status==='loading'?'초안 생성 중…':'초안 생성'}</button>{previous&&<button type="button" disabled={disabled} onClick={undo}>되돌리기</button>}</div>
    {status==='error'&&<p role="alert" className="error-text">{error}</p>}
    {result&&<div role="status">
      <p className="small">{result.provider==='openai'?'AI 초안을 만들었습니다.':'규칙 기반 초안을 만들었습니다.'} 적용 전에는 저장되지 않습니다.</p>
      {result.warnings.map(warning=><p key={warning} className="small">경고: {warning}</p>)}
      <label className="check"><input type="radio" name="website-draft-mode" checked={mode==='fill'} onChange={()=>setMode('fill')}/>빈 칸만 채우기 · 입력한 값은 유지</label>
      <label className="check"><input type="radio" name="website-draft-mode" checked={mode==='overwrite'} onChange={()=>setMode('overwrite')}/>홈 덮어쓰기 · 위 6개 항목만 교체</label>
      <p className="small">{changes.length?`바뀌는 항목: ${changes.map(field=>WEBSITE_DRAFT_FIELD_LABELS[field]).join(', ')}`:'바뀌는 항목이 없습니다.'}</p>
      <div className="actions"><button type="button" className="primary" disabled={disabled||!changes.length} onClick={apply}>초안 적용</button><button type="button" className="quiet" onClick={()=>{setResult(null);setStatus('idle');}}>닫기</button></div>
    </div>}
  </div>;
}
