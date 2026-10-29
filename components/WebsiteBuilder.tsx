'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {EMPTY_WEBSITE, WEBSITE_SECTION_LABELS, validateWebsiteBrief, type WebsiteBrief, type WebsiteProject} from '../lib/website';
import type {MediaAsset} from '../lib/model';
import WebsitePreview from './WebsitePreview';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {cache: 'no-store', ...options});
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || '요청을 처리하지 못했습니다.');
  return body as T;
}

export default function WebsiteBuilder() {
  const [brief, setBrief] = useState<WebsiteBrief>({...EMPTY_WEBSITE});
  const [projects, setProjects] = useState<WebsiteProject[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dirty, setDirty] = useState(false), [error, setError] = useState('');
  const [notice, setNotice] = useState(''), [mediaError, setMediaError] = useState('');
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const busy = loading || saving || exporting;

  async function load() {
    setLoading(true); setError(''); setMediaError('');
    const [saved, assets] = await Promise.allSettled([
      request<WebsiteProject[]>('/api/websites'), request<MediaAsset[]>('/api/media'),
    ]);
    if (saved.status === 'fulfilled') setProjects(saved.value);
    else setError(saved.reason instanceof Error ? saved.reason.message : '프로젝트 목록을 불러오지 못했습니다.');
    if (assets.status === 'fulfilled') setMedia(assets.value.filter(m => m.type === 'image' && m.role !== 'source-capture'));
    else setMediaError('사진 목록을 불러오지 못했습니다. 이미지 없이도 제작할 수 있습니다.');
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function edit<K extends keyof WebsiteBrief>(key: K, value: WebsiteBrief[K]) {
    setBrief(current => ({...current, [key]: value})); setDirty(true); setNotice('');
  }
  function open(project?: WebsiteProject) {
    if (dirty && !window.confirm('저장하지 않은 변경을 버리고 이동할까요?')) return;
    setBrief(project ? {...project, services: [...project.services]} : {...EMPTY_WEBSITE, services: [...EMPTY_WEBSITE.services]});
    setSelectedId(project?.id ?? ''); setDirty(false); setError(''); setNotice(project ? '저장된 프로젝트를 열었습니다.' : '새 프로젝트를 시작합니다.');
  }
  function moveSection(index: number, offset: number) {
    const sections = [...brief.sections];
    const next = index + offset;
    if (next < 0 || next >= sections.length) return;
    [sections[index], sections[next]] = [sections[next], sections[index]];
    edit('sections', sections);
  }
  async function download() {
    if (!selectedId || dirty || busy) return;
    setExporting(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/websites/${selectedId}/export`, {cache: 'no-store'});
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || '내보내지 못했습니다.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `motion-studio-${selectedId}.html`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('HTML 파일을 내려받았습니다. 이미지와 스타일이 포함되어 서버 없이 열 수 있습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '내보내지 못했습니다.'); }
    finally { setExporting(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      const valid = validateWebsiteBrief(brief); setSaving(true);
      const project = await request<WebsiteProject>(selectedId ? `/api/websites/${selectedId}` : '/api/websites', {
        method: selectedId ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(valid),
      });
      setProjects(current => [project, ...current.filter(p => p.id !== project.id)]);
      setSelectedId(project.id); setBrief(project); setDirty(false); setNotice('저장했습니다. 저장된 미리보기를 새 탭에서 열 수 있습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다. 입력 내용은 유지됩니다.'); }
    finally { setSaving(false); }
  }

  return <main className="website-builder">
    <header className="website-builder-header"><div><div className="eyebrow">MOTION STUDIO / WEBSITE</div><h1>브랜드의 첫 페이지를 만드세요.</h1><p>브랜드 정보를 입력하고 랜딩 페이지를 저장·미리보기 합니다.</p></div><a className="button" href="/studio">← 대시보드</a></header>
    <div className="website-scope-note">브랜드 랜딩 MVP · 참고 URL은 기획 자료로 저장됩니다. 사이트 자동 분석·AI 생성·배포는 후속 단계입니다.</div>
    <div className="website-builder-grid">
      <aside className="website-project-list panel"><div className="section-head"><h2>웹 프로젝트</h2><button disabled={busy} onClick={() => open()}>＋ 새로 만들기</button></div>
        {loading ? <p role="status">목록을 불러오는 중…</p> : projects.length === 0 ? <p>아직 저장한 웹 프로젝트가 없습니다. 오른쪽에서 첫 페이지를 만들어 보세요.</p> :
          <ul>{projects.map(project => <li key={project.id}><button className={selectedId === project.id ? 'website-project-active' : ''} aria-pressed={selectedId === project.id} disabled={busy} onClick={() => open(project)}><strong>{project.title}</strong><small>{project.brand} · {new Date(project.updatedAt).toLocaleDateString('ko-KR')}</small></button></li>)}</ul>}
        <button className="quiet" disabled={busy} onClick={() => void load()}>목록 다시 불러오기</button>
        <a className="button" href="/studio?view=media">공유 미디어 등록 ↗</a>
      </aside>
      <form className="website-brief panel" onSubmit={save}>
        <div className="section-head"><h2>브랜드 브리프</h2><span className="save-state">{saving ? '저장 중…' : dirty ? '저장하지 않은 변경' : selectedId ? '저장됨' : '새 프로젝트'}</span></div>
        <fieldset disabled={busy}>
          <label>프로젝트 이름<input required maxLength={120} value={brief.title} placeholder="예: 스튜디오 소개 페이지" onChange={e => edit('title', e.target.value)}/></label>
          <label>브랜드명<input required maxLength={80} value={brief.brand} placeholder="예: MOTION ATELIER" onChange={e => edit('brand', e.target.value)}/></label>
          <label>핵심 문구<input required maxLength={160} value={brief.headline} placeholder="브랜드가 전할 한 문장" onChange={e => edit('headline', e.target.value)}/></label>
          <label>브랜드 소개<textarea required maxLength={1200} rows={4} value={brief.description} placeholder="무엇을 만들고 어떤 가치를 제공하나요?" onChange={e => edit('description', e.target.value)}/></label>
          <label>대상 고객<input maxLength={200} value={brief.audience} placeholder="예: 새로운 공간을 준비하는 브랜드" onChange={e => edit('audience', e.target.value)}/></label>
          <label>참고 사이트 URL · 선택<input type="url" maxLength={2000} value={brief.referenceUrl} placeholder="https://example.com" onChange={e => edit('referenceUrl', e.target.value)}/></label>
          <label>서비스 · 한 줄에 하나, 최대 6개<textarea rows={4} value={brief.services.join('\n')} onChange={e => edit('services', e.target.value.split('\n'))}/></label>
          <label>버튼 문구<input required maxLength={40} value={brief.ctaLabel} onChange={e => edit('ctaLabel', e.target.value)}/></label>
          <div className="website-brief-colors"><label>강조색<input type="color" value={brief.accent} onChange={e => edit('accent', e.target.value)}/></label><label>테마<select value={brief.theme} onChange={e => edit('theme', e.target.value as WebsiteBrief['theme'])}><option value="dark">다크</option><option value="light">라이트</option></select></label></div>
          <label>대표 이미지 · 선택<select value={brief.heroImageId} onChange={e => edit('heroImageId', e.target.value)}><option value="">그래픽 배경 사용</option>{brief.heroImageId && !media.some(m => m.id === brief.heroImageId) && <option value={brief.heroImageId}>기존 이미지 · 목록 확인 필요</option>}{media.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          {mediaError && <p className="small">{mediaError}</p>}
          <div className="website-section-editor"><h3>페이지 섹션</h3><p className="small">첫 화면 아래의 섹션을 표시하거나 순서를 변경하세요.</p>
            <ol>{brief.sections.map((section, index) => <li key={section.id} data-section-editor={section.id}><label className="check"><input type="checkbox" checked={section.enabled} onChange={e => edit('sections', brief.sections.map(item => item.id === section.id ? {...item, enabled: e.target.checked} : item))}/>{WEBSITE_SECTION_LABELS[section.id]}</label><div className="actions"><button type="button" disabled={index === 0} aria-label={`${WEBSITE_SECTION_LABELS[section.id]} 위로`} onClick={() => moveSection(index, -1)}>↑</button><button type="button" disabled={index === brief.sections.length - 1} aria-label={`${WEBSITE_SECTION_LABELS[section.id]} 아래로`} onClick={() => moveSection(index, 1)}>↓</button></div></li>)}</ol>
          </div>
          {brief.sections.some(section => section.id === 'about' && section.enabled) && <div className="website-section-fields"><h3>소개 섹션</h3><label>소개 제목<input maxLength={120} value={brief.aboutHeading} onChange={e => edit('aboutHeading', e.target.value)}/></label><label>소개 본문 · 비우면 브랜드 소개 사용<textarea rows={4} maxLength={1200} value={brief.aboutBody} onChange={e => edit('aboutBody', e.target.value)}/></label></div>}
          {brief.sections.some(section => section.id === 'contact' && section.enabled) && <div className="website-section-fields"><h3>문의 섹션</h3><label>문의 제목<input maxLength={120} value={brief.contactHeading} onChange={e => edit('contactHeading', e.target.value)}/></label><label>문의 안내<textarea rows={3} maxLength={1200} value={brief.contactText} onChange={e => edit('contactText', e.target.value)}/></label><label>문의 링크 · 선택<input type="url" maxLength={2000} placeholder="https://example.com/contact" value={brief.contactUrl} onChange={e => edit('contactUrl', e.target.value)}/></label></div>}
          <button className="primary full" type="submit">{saving ? '저장 중…' : '프로젝트 저장'}</button>
        </fieldset>
        {error && <p role="alert" className="error-text">{error}</p>}
        <p role="status" className="small">{notice}</p>
        {selectedId && <a className="button" href={`/websites/${selectedId}`} target="_blank" rel="noreferrer">저장된 미리보기 열기 ↗</a>}
        <button className="full website-export-button" type="button" disabled={!selectedId || dirty || busy} onClick={() => void download()}>{exporting ? '내보내는 중…' : 'HTML 파일 내보내기 ↓'}</button>
        <p className="small">저장된 내용을 내보냅니다. 변경 후 먼저 저장해 주세요. 문의 링크는 연결만 제공하며 문의 폼 전송 기능은 포함하지 않습니다.</p>
      </form>
      <section className="website-preview-panel" aria-label="랜딩 페이지 미리보기"><div className="section-head"><div><h2>실시간 미리보기</h2><p className="small">입력한 내용으로 구성한 브랜드 랜딩 템플릿</p></div><div className="actions"><button aria-pressed={previewWidth === 'desktop'} onClick={() => setPreviewWidth('desktop')}>데스크톱</button><button aria-pressed={previewWidth === 'mobile'} onClick={() => setPreviewWidth('mobile')}>모바일</button></div></div><div className={`website-preview-frame website-width-${previewWidth}`}><WebsitePreview brief={brief}/></div></section>
    </div>
  </main>;
}
