'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, Grid, OrbitControls, Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { CadModelAsset, CadView } from '../../../lib/model';

type MaterialKey = 'limestone' | 'concrete' | 'sand';
const materials: Record<MaterialKey, { label: string; color: string; emissive: string }> = {
  limestone: { label: '밝은 석재', color: '#c4c0b7', emissive: '#16191c' },
  concrete: { label: '노출 콘크리트', color: '#777c82', emissive: '#121519' },
  sand: { label: '웜 샌드', color: '#b89b7b', emissive: '#1d1711' },
};

function Building({ visibleFloors, exploded, curtainWall, panelSpacing, material }: {
  visibleFloors: boolean[]; exploded: boolean; curtainWall: boolean; panelSpacing: number; material: MaterialKey;
}) {
  const base = materials[material];
  const floors = [0, 1, 2];
  const bays = Math.max(4, Math.round(16 / panelSpacing));
  const bayWidth = 16 / bays;
  return <group>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
      <planeGeometry args={[200, 200]} /><meshStandardMaterial color="#111a27" roughness={0.95} />
    </mesh>
    <Grid position={[0, -0.06, 0]} args={[80, 80]} cellSize={1} cellThickness={0.35} cellColor="#344154" sectionSize={5} sectionThickness={0.75} sectionColor="#53617a" fadeDistance={65} infiniteGrid />
    {floors.map((floor) => {
      if (!visibleFloors[floor]) return null;
      const y = floor * 3.6 + (exploded ? floor * 0.85 : 0);
      return <group key={floor} position={[0, y, 0]}>
        <mesh castShadow receiveShadow position={[0, 0.04, 0]}><boxGeometry args={[16.25, 0.28, 10.25]} /><meshStandardMaterial color={base.color} roughness={0.78} /></mesh>
        <mesh castShadow receiveShadow position={[0, 1.88, -4.91]}><boxGeometry args={[16, 3.4, 0.2]} /><meshStandardMaterial color={base.color} roughness={0.82} /></mesh>
        <mesh castShadow receiveShadow position={[-7.91, 1.88, 0]}><boxGeometry args={[0.2, 3.4, 10]} /><meshStandardMaterial color={base.color} roughness={0.82} /></mesh>
        <mesh castShadow receiveShadow position={[7.91, 1.88, 0]}><boxGeometry args={[0.2, 3.4, 10]} /><meshStandardMaterial color={base.color} roughness={0.82} /></mesh>
        {curtainWall ? <group>
          {Array.from({ length: bays }, (_, i) => {
            const x = -8 + bayWidth * (i + 0.5);
            return <group key={i}>
              <mesh position={[x, 1.88, 4.9]}><boxGeometry args={[bayWidth - 0.075, 3.23, 0.075]} /><meshPhysicalMaterial color="#7897ac" roughness={0.18} metalness={0.12} transparent opacity={0.39} /></mesh>
              <mesh castShadow position={[-8 + bayWidth * i, 1.88, 4.86]}><boxGeometry args={[0.075, 3.38, 0.12]} /><meshStandardMaterial color="#5d6b73" metalness={0.55} roughness={0.38} /></mesh>
            </group>;
          })}
          <mesh castShadow position={[8, 1.88, 4.86]}><boxGeometry args={[0.075, 3.38, 0.12]} /><meshStandardMaterial color="#5d6b73" metalness={0.55} roughness={0.38} /></mesh>
          <mesh castShadow position={[0, 0.22, 4.86]}><boxGeometry args={[16.05, 0.11, 0.12]} /><meshStandardMaterial color="#5d6b73" metalness={0.55} roughness={0.38} /></mesh>
          <mesh castShadow position={[0, 3.54, 4.86]}><boxGeometry args={[16.05, 0.11, 0.12]} /><meshStandardMaterial color="#5d6b73" metalness={0.55} roughness={0.38} /></mesh>
        </group> : <mesh castShadow position={[0, 1.88, 4.91]}><boxGeometry args={[16, 3.4, 0.2]} /><meshStandardMaterial color={base.color} roughness={0.82} /></mesh>}
        <group position={[-8.5, 3.0, 4.9]}>
          <mesh position={[0, 0, -0.025]}><boxGeometry args={[2.25, 0.44, 0.05]} /><meshBasicMaterial color="#151b29" transparent opacity={0.86} /></mesh>
          <Text position={[0, 0, 0.01]} fontSize={0.19} color="#d2c8f1" anchorX="center" anchorY="middle" letterSpacing={0.08}>
            {`0${floor + 1} / ${floor === 0 ? 'GROUND' : `LEVEL ${floor + 1}`}`}
          </Text>
        </group>
      </group>;
    })}
    <mesh castShadow receiveShadow position={[0, 11.02 + (exploded ? 1.7 : 0), 0]}>
      <boxGeometry args={[16.45, 0.3, 10.45]} /><meshStandardMaterial color="#d5d0c7" roughness={0.72} />
    </mesh>
  </group>;
}

function UploadedBuilding({ url, visibleFloors, exploded, onDimensions }: { url: string; visibleFloors: boolean[]; exploded: boolean; onDimensions: (dimensions: { width: number; depth: number; height: number }) => void }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const dimensions = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -box.min.y, -center.z);
    clone.traverse((object) => {
      const storeyId = object.userData.storeyId;
      if (typeof storeyId === 'string' && /^\d+$/.test(storeyId)) {
        const floorIndex = Number(storeyId) - 1;
        const baseElevation = Number(object.userData.elevationM ?? floorIndex * 3.6);
        object.visible = visibleFloors[floorIndex] ?? true;
        object.position.y = baseElevation + (exploded ? floorIndex * 0.85 : 0);
      } else if (object.userData.system === 'roof' && typeof object.userData.elevationM === 'number') {
        object.position.y = object.userData.elevationM + (exploded ? 1.7 : 0);
      }
    });
    return { scene: clone, dimensions: { width: dimensions.x, depth: dimensions.z, height: dimensions.y } };
  }, [scene, visibleFloors, exploded]);
  useEffect(() => onDimensions(model.dimensions), [model, onDimensions]);
  return <primitive object={model.scene} />;
}

type Vec3 = [number, number, number];
type CameraState = { position: Vec3; target: Vec3 };
type CameraBridgeHandle = { read: () => CameraState | null };
type OrbitLike = { target: THREE.Vector3; update: () => void };

// Reads and applies the camera. Saved views use the viewer's re-centered clone space (see UploadedBuilding), the same space the camera lives in.
function CameraBridge({ handle, applied }: { handle: { current: CameraBridgeHandle | null }; applied: { nonce: number; camera: CameraState } | null }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null;
  useEffect(() => {
    handle.current = { read: () => controls ? { position: camera.position.toArray() as Vec3, target: controls.target.toArray() as Vec3 } : null };
    return () => { handle.current = null; };
  }, [camera, controls, handle]);
  useEffect(() => {
    if (!applied || !controls) return;
    camera.position.set(...applied.camera.position);
    controls.target.set(...applied.camera.target);
    controls.update();
  }, [applied, camera, controls]);
  return null;
}

export default function ArchitecturalViewer() {
  const [floors, setFloors] = useState([true, true, true]);
  const [exploded, setExploded] = useState(false);
  const [curtain, setCurtain] = useState(true);
  const [spacing, setSpacing] = useState(1.2);
  const [material, setMaterial] = useState<MaterialKey>('limestone');
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelName, setModelName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savedModels, setSavedModels] = useState<CadModelAsset[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelStoreyCount, setModelStoreyCount] = useState(0);
  const [modelSize, setModelSize] = useState<{ width: number; depth: number; height: number } | null>(null);
  const [savingModel, setSavingModel] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [background, setBackground] = useState('#101722');
  const [views, setViews] = useState<CadView[]>([]);
  const [viewName, setViewName] = useState('');
  const [viewMessage, setViewMessage] = useState('');
  const [applied, setApplied] = useState<{ nonce: number; camera: CameraState } | null>(null);
  const cameraHandle = useRef<CameraBridgeHandle | null>(null);
  const handleModelDimensions = useCallback((next: { width: number; depth: number; height: number }) => {
    setModelSize((previous) => previous && Math.abs(previous.width - next.width) < 0.01 && Math.abs(previous.depth - next.depth) < 0.01 && Math.abs(previous.height - next.height) < 0.01 ? previous : next);
  }, []);
  // Floor switches follow the model's storey count (3 for the built-in sample); a new model drops any restored camera so Bounds fits it again.
  useEffect(() => { setFloors(Array(modelUrl ? modelStoreyCount : 3).fill(true)); setExploded(false); setApplied(null); setBackground('#101722'); }, [modelUrl, modelStoreyCount]);
  useEffect(() => {
    setViews([]); setViewMessage('');
    if (!selectedModelId) return;
    let active = true;
    fetch(`/api/models/${selectedModelId}/views`).then((response) => response.ok ? response.json() : Promise.reject(new Error('뷰를 불러오지 못했습니다.')))
      .then((list: CadView[]) => { if (active) setViews(list); })
      .catch(() => { if (active) setViewMessage('저장된 뷰를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [selectedModelId]);
  useEffect(() => () => { if (modelUrl?.startsWith('blob:')) URL.revokeObjectURL(modelUrl); }, [modelUrl]);
  useEffect(() => {
    let active = true;
    fetch('/api/models').then((response) => response.ok ? response.json() : Promise.reject(new Error('모델 목록을 불러오지 못했습니다.')))
      .then((models: CadModelAsset[]) => { if (active) setSavedModels(models); })
      .catch(() => { if (active) setError('모델 라이브러리를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, []);

  async function chooseModel(file?: File) {
    setError('');
    setSaveMessage('');
    setSelectedFile(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb')) { setError('웹에서 바로 확인할 수 있도록 단일 파일 GLB를 선택해 주세요.'); return; }
    if (file.size > 100 * 1024 * 1024) { setError('로컬 미리보기 파일은 100MB 이하로 선택해 주세요.'); return; }
    const header = new DataView(await file.slice(0, 20).arrayBuffer());
    if (header.byteLength < 20 || header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== file.size || header.getUint32(16, true) !== 0x4e4f534a || 20 + header.getUint32(12, true) > file.size) {
      setError('유효한 glTF 2.0 GLB 파일인지 확인해 주세요.'); return;
    }
    let storeyCount = 0;
    try {
      const gltf = JSON.parse(await file.slice(20, 20 + header.getUint32(12, true)).text());
      if (gltf.asset?.version !== '2.0' || !Array.isArray(gltf.nodes) || !Array.isArray(gltf.meshes) || !Array.isArray(gltf.scenes)) throw new Error('invalid glTF');
      storeyCount = new Set(gltf.nodes.map((node: { extras?: { storeyId?: unknown } }) => node.extras?.storeyId).filter((id: unknown) => typeof id === 'string')).size;
    } catch { setError('GLB 장면 정보가 올바르지 않습니다.'); return; }
    setModelUrl(URL.createObjectURL(file));
    setModelName(file.name);
    setSelectedFile(file);
    setSelectedModelId(null);
    setModelStoreyCount(storeyCount);
    setModelSize(null);
  }

  async function previewExampleModel() {
    try {
      const response = await fetch('/models/pavilion-demo.glb');
      if (!response.ok) throw new Error('예제 GLB 파일을 찾을 수 없습니다.');
      const file = new File([await response.blob()], 'pavilion-demo.glb', { type: 'model/gltf-binary' });
      await chooseModel(file);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '예제 모델을 열지 못했습니다.'); }
  }

  async function saveSelectedModel() {
    if (!selectedFile || savingModel) return;
    setSavingModel(true); setError(''); setSaveMessage('');
    try {
      const form = new FormData(); form.set('file', selectedFile);
      const response = await fetch('/api/models', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '모델을 저장하지 못했습니다.');
      const saved = result as CadModelAsset;
      setSavedModels((current) => [saved, ...current.filter((model) => model.id !== saved.id)]);
      setModelUrl(`/api/models/${saved.id}/asset`);
      setModelName(saved.name);
      setSelectedModelId(saved.id);
      setModelStoreyCount(saved.storeyCount);
      setModelSize(null);
      setSelectedFile(null);
      setSaveMessage('모델 라이브러리에 저장했습니다.');
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : '모델을 저장하지 못했습니다.'); }
    finally { setSavingModel(false); }
  }

  async function deleteSavedModel(model: CadModelAsset) {
    if (!window.confirm(`“${model.name}”을(를) 모델 라이브러리에서 영구 삭제할까요?`)) return;
    try {
      const response = await fetch(`/api/models/${model.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '모델을 삭제하지 못했습니다.');
      setSavedModels((current) => current.filter((item) => item.id !== model.id));
      if (selectedModelId === model.id) {
        setModelUrl(null); setModelName(''); setSelectedModelId(null); setModelStoreyCount(0); setModelSize(null);
      }
      setSaveMessage('모델을 삭제했습니다.');
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : '모델을 삭제하지 못했습니다.'); }
  }
  async function saveCurrentView() {
    const current = cameraHandle.current?.read();
    if (!selectedModelId || !current) return;
    setViewMessage('');
    try {
      const response = await fetch(`/api/models/${selectedModelId}/views`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaVersion: 1, name: viewName.trim(), camera: current, floors, exploded, background }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '뷰를 저장하지 못했습니다.');
      setViews((list) => [...list, result as CadView]); setViewName(''); setViewMessage('뷰를 저장했습니다.');
    } catch (saveError) { setViewMessage(saveError instanceof Error ? saveError.message : '뷰를 저장하지 못했습니다.'); }
  }
  function applyView(view: CadView) {
    setFloors(view.floors); setExploded(view.exploded); setBackground(view.background);
    setApplied({ nonce: Date.now(), camera: view.camera }); setViewMessage('');
  }
  async function removeView(view: CadView) {
    if (!selectedModelId) return;
    try {
      const response = await fetch(`/api/models/${selectedModelId}/views/${view.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || '뷰를 삭제하지 못했습니다.');
      setViews((list) => list.filter((item) => item.id !== view.id)); setViewMessage('뷰를 삭제했습니다.');
    } catch (deleteError) { setViewMessage(deleteError instanceof Error ? deleteError.message : '뷰를 삭제하지 못했습니다.'); }
  }
  const selectedModel = savedModels.find((model) => model.id === selectedModelId);
  const visibleFloorCount = floors.filter(Boolean).length;
  const hasUploadedModel = Boolean(modelUrl);
  return <main className="cad-viewer-page">
    <header className="cad-viewer-header">
      <a className="cad-viewer-back" href="/architecture">← 개발 구조도</a>
      <div><span className="cad-viewer-kicker">MOTION STUDIO / SPATIAL LAB</span><h1>건축 모델 뷰어</h1><p>파라미터를 조절하고 층별 구성과 외장 시스템을 확인합니다.</p></div>
      <div className="cad-viewer-chip"><i /> 브라우저 시제품</div>
    </header>
    <div className="cad-viewer-workspace">
      <aside className="cad-viewer-controls">
        <section className="cad-upload">
          <div className="cad-control-heading"><span>01</span><div><b>내 모델 불러오기</b><small>GLB · 최대 100 MiB</small></div></div>
          <label className="cad-upload-button">{modelName ? '다른 파일 선택' : 'GLB 파일 선택'}<input type="file" accept=".glb,model/gltf-binary" onChange={(event) => chooseModel(event.target.files?.[0])} /></label>
          <button className="cad-toggle" onClick={previewExampleModel}>파라메트릭 GLB 예제 열기</button>
          <a className="cad-example-download" href="/models/pavilion-demo.glb" download="motion-studio-pavilion-demo.glb">예제 모델 파일 받기 ↓</a>
          {modelName && <div className="cad-file-row"><span title={modelName}>{modelName}</span>{selectedFile && <button disabled={savingModel} onClick={saveSelectedModel}>{savingModel ? '저장 중…' : '라이브러리에 저장'}</button>}</div>}
          {hasUploadedModel && <button className="cad-toggle" onClick={() => { setModelUrl(null); setModelName(''); setSelectedFile(null); setSelectedModelId(null); setModelStoreyCount(0); setModelSize(null); }}>샘플 건물로 돌아가기</button>}
          {error && <p className="cad-error">{error}</p>}
          {saveMessage && <p className="cad-saved-message">{saveMessage}</p>}
          <p className="cad-hint">파일 선택은 로컬 미리보기입니다. 저장 버튼을 누르면 프로젝트 데이터 폴더에 복사됩니다.</p>
          {savedModels.length > 0 && <div className="cad-model-library"><small>저장된 모델 · {savedModels.length}</small>{savedModels.map((model) => <div key={model.id} className="cad-model-entry"><button className={selectedModelId === model.id ? 'selected' : ''} onClick={() => { setModelUrl(`/api/models/${model.id}/asset`); setModelName(model.name); setSelectedFile(null); setSelectedModelId(model.id); setModelStoreyCount(model.storeyCount); setModelSize(null); setSaveMessage(''); }}><b>{model.name}</b><span>{model.storeyCount || '—'} floors · {model.nodeCount} nodes · {(model.sizeBytes / 1024 / 1024).toFixed(1)} MiB</span></button><button className="cad-model-delete" onClick={() => deleteSavedModel(model)} aria-label={`${model.name} 삭제`}>×</button></div>)}</div>}
        </section>
        <section className="cad-control-section">
          <div className="cad-control-heading"><span>02</span><div><b>건물 구성</b><small>{hasUploadedModel ? modelStoreyCount ? `${modelStoreyCount}개 층 메타데이터 감지` : '층별 메타데이터 없음' : `${visibleFloorCount}개 층 표시 · 층고 3.6 m`}</small></div></div>
          <div className="cad-floor-list">{floors.map((visible, index) => <label key={index}><span><i>0{index + 1}</i> {index === 0 ? '1층 · 기준층' : `${index + 1}층 · 3.6 m 반복`}</span><input type="checkbox" disabled={hasUploadedModel && !modelStoreyCount} checked={visible} onChange={() => setFloors((current) => current.map((v, i) => i === index ? !v : v))} /></label>)}</div>
          <button disabled={hasUploadedModel && !modelStoreyCount} className={`cad-toggle ${exploded ? 'selected' : ''}`} onClick={() => setExploded(!exploded)}><span>↕</span> 층 분해도 {exploded ? '켜짐' : '보기'}</button>
        </section>
        {selectedModelId && <section className="cad-control-section">
          <div className="cad-control-heading"><span>V</span><div><b>저장된 뷰</b><small>{views.length}/20 · 카메라·층·분해·배경색</small></div></div>
          {selectedModel?.invalid ? <p className="cad-error">검증에 실패한 모델이라 뷰를 쓸 수 없습니다. 모델을 다시 등록해 주세요.</p> : <>
            <label className="cad-range-label"><span>배경색</span><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} aria-label="배경색" /></label>
            <input className="cad-view-name" type="text" maxLength={60} value={viewName} placeholder="뷰 이름" onChange={(event) => setViewName(event.target.value)} />
            <button className="cad-toggle" disabled={!viewName.trim() || views.length >= 20} onClick={saveCurrentView}>현재 보기 저장</button>
            {views.map((view) => <div key={view.id} className="cad-model-entry"><button onClick={() => applyView(view)}><b>{view.name}</b></button><button className="cad-model-delete" onClick={() => removeView(view)} aria-label={`${view.name} 삭제`}>×</button></div>)}
          </>}
          {viewMessage && <p className="cad-hint" role="status">{viewMessage}</p>}
        </section>}
        <section className="cad-control-section">
          <div className="cad-control-heading"><span>03</span><div><b>남측 커튼월</b><small>파사드 모듈 간격</small></div></div>
          <label className="cad-switch"><span>유리 파사드</span><input type="checkbox" disabled={hasUploadedModel} checked={curtain} onChange={(e) => setCurtain(e.target.checked)} /></label>
          <label className="cad-range-label"><span>패널 간격</span><b>{spacing.toFixed(1)} m</b></label>
          <input className="cad-range" type="range" disabled={hasUploadedModel} min="0.8" max="2.4" step="0.1" value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} />
          <div className="cad-range-scale"><span>0.8 m</span><span>2.4 m</span></div>
        </section>
        <section className="cad-control-section">
          <div className="cad-control-heading"><span>04</span><div><b>재료 표현</b><small>뷰어 시각화 설정</small></div></div>
          <div className="cad-materials">{(Object.keys(materials) as MaterialKey[]).map((key) => <button key={key} disabled={hasUploadedModel} className={material === key ? 'selected' : ''} onClick={() => setMaterial(key)}><i style={{ background: materials[key].color }} />{materials[key].label}</button>)}</div>
        </section>
        <footer className="cad-controls-footer"><span>UNIT</span><b>{hasUploadedModel ? 'GLTF · METERS' : 'METERS · DEMO'}</b><span>COORDINATE</span><b>{hasUploadedModel ? 'GLB LOCAL AXIS' : 'X EAST · Y UP · Z SOUTH'}</b></footer>
      </aside>
      <section className="cad-viewport-section">
        <div className="cad-viewport-top"><div><span className="cad-live-dot" /> 3D MODEL SPACE <small>· {modelName || 'CONCEPT STUDY 001'}</small></div><span>ORTHO / PERSPECTIVE</span></div>
        <div className="cad-canvas">
          <Canvas shadows dpr={[1, 1.6]} camera={{ position: [23, 16, 22], fov: 36 }} gl={{ antialias: true }}>
            <color attach="background" args={[background]} />
            <ambientLight intensity={1.05} />
            <hemisphereLight args={['#dbeafe', '#293445', 1.3]} />
            <directionalLight position={[10, 18, 12]} intensity={3} castShadow shadow-mapSize={[2048, 2048]} />
            <directionalLight position={[-12, 9, -8]} intensity={1.2} color="#a6c8ff" />
            <CameraBridge handle={cameraHandle} applied={applied} />
            <Suspense fallback={null}>{modelUrl ? applied ? <UploadedBuilding url={modelUrl} visibleFloors={floors} exploded={exploded} onDimensions={handleModelDimensions} /> : <Bounds key={`${modelUrl}:${floors.map((visible) => Number(visible)).join('')}:${Number(exploded)}`} fit clip observe margin={1.3}><UploadedBuilding url={modelUrl} visibleFloors={floors} exploded={exploded} onDimensions={handleModelDimensions} /></Bounds> : <Building visibleFloors={floors} exploded={exploded} curtainWall={curtain} panelSpacing={spacing} material={material} />}</Suspense>
            <OrbitControls makeDefault target={[0, 5.2, 0]} minDistance={12} maxDistance={65} maxPolarAngle={Math.PI * 0.48} />
          </Canvas>
          <div className="cad-orientation"><b>N</b><span>▲</span><small>S</small></div>
          <div className="cad-viewport-tip"><span>좌클릭 드래그</span> 회전 <i /> <span>휠</span> 줌 <i /> <span>우클릭 드래그</span> 이동</div>
          <div className="cad-model-stamp"><span>{hasUploadedModel ? 'MS / GLB PREVIEW' : 'MS / A-001'}</span><b>{hasUploadedModel ? modelName : 'EXHIBITION PAVILION'}</b><small>{hasUploadedModel ? 'GLTF METERS · SOURCE SCALE PRESERVED' : 'SCHEMATIC MODEL · REV 00'}</small></div>
        </div>
        <div className="cad-model-data"><div><span>BUILDING</span><b>{hasUploadedModel ? modelSize ? `${modelSize.width.toFixed(2)} × ${modelSize.depth.toFixed(2)} × ${modelSize.height.toFixed(2)} m` : 'MEASURING…' : '16 × 10 m'}</b></div><div><span>LEVELS</span><b>{hasUploadedModel ? modelStoreyCount ? `${modelStoreyCount} STOREYS` : 'GLB NODE TREE' : '03 / 10.8 m'}</b></div><div><span>FACADE</span><b>{hasUploadedModel ? 'GLB MATERIALS' : curtain ? `SOUTH · ${spacing.toFixed(1)} m` : 'SOUTH · CLOSED'}</b></div><div><span>MODEL SOURCE</span><b>{selectedModelId ? 'PROJECT LIBRARY' : selectedFile ? 'LOCAL GLB' : hasUploadedModel ? 'GLB' : 'PARAMETRIC DEMO'}</b></div></div>
        <div className="cad-viewer-disclaimer">개념 검토용 시제품입니다. 구조·시공·법규 검토를 마친 설계 모델이 아닙니다.</div>
      </section>
    </div>
  </main>;
}
