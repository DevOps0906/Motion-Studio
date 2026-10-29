'use client';
import {useEffect,useState} from 'react';
import type {RenderJob} from '../lib/model';
export default function ExportCenter(){
 const [jobs,setJobs]=useState<RenderJob[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setError('');setLoading(true);try{const response=await fetch('/api/renders',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'렌더 목록을 불러오지 못했습니다.');setJobs(data.filter((job:RenderJob)=>job.status==='completed'));}catch(cause){setError((cause as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 return <main className="export-center"><div className="eyebrow">MOTION STUDIO / HANDOFF</div><h1>CapCut에서 이어서 편집하세요.</h1><p>Motion Studio는 직접 만든 템플릿 기반 제작 화면이며 Remotion으로 영상을 렌더합니다. CapCut은 별도 프로그램입니다.</p>
 <section className="panel"><h2>가져오는 방법</h2><ol><li>프로젝트에서 프리셋과 해상도를 선택하고 MP4를 렌더합니다.</li><li>완료된 작업에서 MP4 또는 미디어 ZIP을 내려받습니다.</li><li>CapCut의 새 프로젝트 → 가져오기에서 MP4를 선택합니다. ZIP은 먼저 압축 해제하세요.</li></ol><p>MP4는 합성된 영상 한 개입니다. 사진·로고·음악을 개별 재편집하려면 ZIP의 media 폴더도 가져오세요. 모션과 트랙이 CapCut 프로젝트로 자동 변환되지는 않습니다.</p><a className="button" href="https://www.capcut.com/" target="_blank" rel="noreferrer">CapCut 열기 ↗</a> <a className="button" href="/studio?view=renders">렌더 작업 보기</a></section>
 <section><div className="section-head"><h2>완료된 영상</h2><button onClick={()=>void load()} disabled={loading}>새로고침</button></div>{error&&<p role="alert" className="error-text">{error}</p>}{loading?<p role="status">불러오는 중…</p>:!jobs.length?<div className="empty-state">완료된 렌더가 없습니다. <a className="button" href="/studio?view=projects">영상 프로젝트 열기</a></div>:<div className="jobs">{jobs.map(job=><article className="job-card" key={job.id}><h3>{job.projectSnapshot.title}</h3><p>{job.projectSnapshot.resolution.width}×{job.projectSnapshot.resolution.height} · {job.projectSnapshot.fps}fps · {job.projectSnapshot.durationSeconds}초</p><div className="actions"><a className="button primary" href={`/api/renders/${job.id}/download?target=capcut`}>CapCut용 MP4 ↓</a><a className="button" href={`/api/renders/${job.id}/capcut`}>사진·음악 포함 ZIP ↓</a></div></article>)}</div>}</section>
 </main>;
}
