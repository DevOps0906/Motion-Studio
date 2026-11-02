import {useMemo} from 'react';
import {AbsoluteFill,Audio,Sequence,useCurrentFrame,useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import * as THREE from 'three';
import {cameraAt,DEFAULT_PROJECT,placeStoreys,type MediaAsset,type Project} from '../lib/model';
import {audioVolume} from '../lib/motion';
// task-010 B: 3D walkthrough. The GLB comes from the render snapshot asset URL.
// `edits` is the slot for the C-plan edit document (null = none).
export type WalkthroughProps={project:Project;media:MediaAsset[];model:{url:string}|null;edits:unknown};
function Rig({project}:{project:Project}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),camera=useThree(state=>state.camera);
 if(project.scene3d){const c=cameraAt(project.scene3d,frame/fps);camera.position.set(...c.position);camera.lookAt(...c.target);camera.updateMatrixWorld();}
 return null;
}
// Same placement as the viewer's UploadedBuilding (clone re-centered: x/z centered, lowest point at y=0; storey/roof elevation), all floors visible, not exploded.
// useGLTF(url,false,false): Draco and meshopt decoders off (they would load from an external CDN; validateGlb refuses such models). ThreeCanvas holds the frame while Suspense loads it.
function Model({url,edits}:{url:string;edits:unknown}){
 const {scene}=useGLTF(url,false,false);
 const object=useMemo(()=>{
  const clone=scene.clone(true),box=new THREE.Box3().setFromObject(clone),center=box.getCenter(new THREE.Vector3());
  clone.position.set(-center.x,-box.min.y,-center.z);
  // C-plan: when edits!==null, apply the edit document to the clone here (before placeStoreys). null leaves the model as is.
  void edits;
  placeStoreys(clone);
  return clone;
 },[scene,edits]);
 return <primitive object={object}/>;
}
export function Walkthrough3D({project=DEFAULT_PROJECT,media=[],model=null,edits=null}:Partial<WalkthroughProps>){
 const {fps,width,height}=useVideoConfig(),track=media.find(m=>m.id===project.audio.assetId)?.url,startFrame=Math.round(project.audio.startSeconds*fps);
 return <AbsoluteFill style={{backgroundColor:project.background}}>
  {model&&project.scene3d&&<ThreeCanvas width={width} height={height} camera={{position:project.scene3d.keyframes[0].camera.position,fov:36}}>
   <color attach="background" args={[project.background]}/>
   <ambientLight intensity={1.05}/><hemisphereLight args={['#dbeafe','#293445',1.3]}/>
   <directionalLight position={[10,18,12]} intensity={3}/><directionalLight position={[-12,9,-8]} intensity={1.2} color="#a6c8ff"/>
   <Rig project={project}/><Model url={model.url} edits={edits}/>
  </ThreeCanvas>}
  {track&&startFrame<Math.round(project.durationSeconds*fps)&&<Sequence from={startFrame}><Audio src={track} trimBefore={Math.round(project.audio.trimStartSeconds*fps)} volume={f=>audioVolume((f+startFrame)/fps,project.durationSeconds,project.audio)}/></Sequence>}
 </AbsoluteFill>;
}
