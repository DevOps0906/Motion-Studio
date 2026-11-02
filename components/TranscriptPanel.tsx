'use client';
import {useEffect,useRef,useState} from 'react';
import {validateSegments,type CaptionSegment,type MediaAsset} from '../lib/model';
import {captionRowsTruncated,type TranscriptJob,type TranscriptLanguage,type TranscriptMode} from '../lib/transcript';
type Engines={maxSeconds:number;local:{accurate:boolean;fast:boolean};remote:boolean};
const ACTIVE=['queued','processing'];
// task-011: speech to caption sentences for the captioned-video templates. Local engine by default; the external one is operator-only and needs consent on every request.
export default function TranscriptPanel({media,onFill}:{media:MediaAsset[];onFill:(segments:CaptionSegment[])=>void}){
 const [engines,setEngines]=useState<Engines|null>(null),[mediaId,setMediaId]=useState(''),[engine,setEngine]=useState<'local'|'remote'>('local'),[mode,setMode]=useState<TranscriptMode>('accurate'),[language,setLanguage]=useState<TranscriptLanguage>('ko'),[consent,setConsent]=useState(false);
 const [job,setJob]=useState<TranscriptJob|null>(null),[segments,setSegments]=useState<CaptionSegment[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const sources=media.filter(item=>(item.type==='video'||item.type==='audio')&&typeof item.durationSeconds==='number'&&item.durationSeconds<=(engines?.maxSeconds??300));
 const localReady=!!engines&&(engines.local.accurate||engines.local.fast);
 const mediaIdRef=useRef('');mediaIdRef.current=mediaId;
 const shownFor=job?.mediaId;
 useEffect(()=>{
  if(!mediaId||shownFor===mediaId)return;
  let live=true;
  (async()=>{try{const response=await fetch('/api/transcripts'),jobs=await response.json();if(!live||!response.ok||!Array.isArray(jobs))return;const latest=jobs.find((item:TranscriptJob)=>item.mediaId===mediaId);setJob(latest||null);setSegments(latest?.segments||[]);}catch{}})();
  return()=>{live=false;};
 },[mediaId,shownFor]);
 useEffect(()=>{
  let live=true;
  (async()=>{
   try{
    const response=await fetch('/api/transcripts/engines'),data=await response.json();if(!response.ok)throw Error(data.error);
    const list=await fetch('/api/transcripts'),jobs=await list.json();
    if(!live)return;
    setEngines(data);setMode(data.local.accurate?'accurate':'fast');
    // Resume the latest job of the file currently chosen (none chosen yet: nothing is shown).
    const latest=Array.isArray(jobs)?jobs.find((item:TranscriptJob)=>item.mediaId===mediaIdRef.current):undefined;
    if(list.ok&&latest){setJob(latest);setSegments(latest.segments||[]);}
   }catch(cause){if(live)setError((cause as Error).message);}
  })();
  return()=>{live=false;};
 },[]);
 useEffect(()=>{
  if(!job||!ACTIVE.includes(job.status))return;
  let live=true,failures=0;
  const id=job.id;
  const timer=setInterval(async()=>{
   try{const response=await fetch('/api/transcripts/'+encodeURIComponent(id)),data=await response.json();if(!response.ok)throw Error(data.error);if(!live)return;failures=0;setJob(data);if(data.status==='done')setSegments(data.segments||[]);}
   catch(cause){if(!live)return;failures++;if(failures>=3){clearInterval(timer);setError('진행 상황을 가져오지 못해 확인을 멈췄습니다. 페이지를 새로 고쳐 주세요.');}else setError((cause as Error).message);}
  },2500);
  return()=>{live=false;clearInterval(timer);};
 },[job?.id,job?.status]);
 async function call(url:string,init?:RequestInit){const response=await fetch(url,init),data=await response.json();if(!response.ok)throw Error(data.error);return data;}
 async function start(){
  setBusy(true);setError('');setNotice('');
  try{const data:TranscriptJob=await call('/api/transcripts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mediaId,engine,mode,language,consent:engine==='remote'?consent:undefined})});setJob(data);setSegments([]);}
  catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 async function cancel(){if(!job)return;try{await call(`/api/transcripts/${encodeURIComponent(job.id)}/cancel`,{method:'POST'});}catch(cause){setError((cause as Error).message);}}
 async function saveEdits(){
  if(!job)return;setError('');
  try{const checked=validateSegments(segments,job.durationSeconds);const data:TranscriptJob=await call('/api/transcripts/'+encodeURIComponent(job.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({segments:checked})});setJob(data);setSegments(data.segments||[]);setNotice('수정한 자막을 저장했습니다.');}
  catch(cause){setError((cause as Error).message);}
 }
 const change=(index:number,patch:Partial<CaptionSegment>)=>{setSegments(segments.map((item,i)=>i===index?{...item,...patch}:item));setNotice('');};
 const canStart=!!mediaId&&!busy&&!(job&&ACTIVE.includes(job.status))&&(engine==='remote'?consent&&!!engines?.remote:localReady);
 return <section className="transcript-panel" aria-label="음성으로 자막 채우기">
  <h2>음성으로 자막 채우기</h2>
  {!engines&&!error&&<p role="status">음성 인식 상태를 확인하는 중입니다.</p>}
  {engines&&!localReady&&!engines.remote&&<p className="content-template-note">이 서버에는 음성 인식 모델이 설치되어 있지 않습니다. 운영자에게 <code>npm run stt:model</code> 설치를 요청해 주세요.</p>}
  {engines&&(localReady||engines.remote)&&<div className="transcript-controls">
   <label>영상·오디오 (5분 이하)<select value={mediaId} onChange={e=>setMediaId(e.target.value)}><option value="">선택하세요</option>{sources.map(item=><option value={item.id} key={item.id}>{item.name} · {Math.round(item.durationSeconds||0)}초</option>)}</select></label>
   {engines.remote&&<label>방식<select value={engine} onChange={e=>{setEngine(e.target.value as 'local'|'remote');setConsent(false);}}><option value="local" disabled={!localReady}>이 서버에서 처리 (오디오가 서버 밖으로 나가지 않음)</option><option value="remote">외부 서비스 (운영자 전용)</option></select></label>}
   {engine==='local'&&<label>정확도<select value={mode} onChange={e=>setMode(e.target.value as TranscriptMode)}><option value="accurate" disabled={!engines.local.accurate}>정확하게 (느림)</option><option value="fast" disabled={!engines.local.fast}>빠르게</option></select></label>}
   <label>언어<select value={language} onChange={e=>setLanguage(e.target.value as TranscriptLanguage)}><option value="ko">한국어</option><option value="en">영어</option><option value="auto">자동 감지</option></select></label>
   {engine==='remote'&&<label className="transcript-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> 선택한 파일의 오디오(영상 화면은 제외)가 외부 사업자의 서버로 전송되는 것에 동의합니다. 요청할 때마다 확인합니다.</label>}
   <button type="button" className="primary" disabled={!canStart} onClick={()=>void start()}>음성 인식 시작</button>
  </div>}
  {job&&ACTIVE.includes(job.status)&&<div role="status"><p>{job.stage} · {Math.round(job.progress*100)}%</p><progress max={1} value={job.progress}/><button type="button" onClick={()=>void cancel()}>취소</button></div>}
  {job&&job.status==='failed'&&<p role="alert">{job.error||'음성 인식에 실패했습니다.'}</p>}
  {job&&job.status==='canceled'&&<p role="status">음성 인식을 취소했습니다.</p>}
  {job&&job.status==='done'&&<div className="transcript-result">
   <p>{segments.length}개 구간 · 인식 결과는 틀릴 수 있으니 문장과 시간을 확인해 주세요.</p>
   <p className="content-template-note">8행·행당 120자까지만 템플릿에 반영됩니다. 전체 자막과 시간은 SRT로 받으세요.</p>
   {segments.map((segment,index)=><div className="transcript-segment" key={index}>
    <input type="number" aria-label={`구간 ${index+1} 시작(초)`} step={0.1} min={0} value={segment.start} onChange={e=>change(index,{start:Number(e.target.value)})}/>
    <input type="number" aria-label={`구간 ${index+1} 끝(초)`} step={0.1} min={0} value={segment.end} onChange={e=>change(index,{end:Number(e.target.value)})}/>
    <input aria-label={`구간 ${index+1} 문장`} maxLength={200} value={segment.text} onChange={e=>change(index,{text:e.target.value})}/>
   </div>)}
   <div className="actions">
    <button type="button" onClick={()=>void saveEdits()}>수정 저장</button>
    <button type="button" className="primary" onClick={()=>{try{const checked=validateSegments(segments,job.durationSeconds);onFill(checked);setNotice(captionRowsTruncated(checked)?'일부 문장이 잘려 반영되었습니다. 전체 자막과 시간은 SRT로 받으세요.':'자막 문장을 채웠습니다. 프로젝트 저장 전에 확인하세요.');setError('');}catch(cause){setError((cause as Error).message);}}}>자막 문장으로 채우기</button>
    <a className="button" href={`/api/transcripts/${encodeURIComponent(job.id)}/export`} download>SRT 내려받기</a>
   </div>
  </div>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
