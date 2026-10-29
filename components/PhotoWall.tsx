"use client";
import {useMemo,useEffect,useLayoutEffect,Component,type ReactNode} from 'react';
import {useThree} from '@react-three/fiber';
import {useTexture,PerspectiveCamera} from '@react-three/drei';
import {Shape,ShapeGeometry} from 'three';
import {getRemotionEnvironment,cancelRender} from 'remotion';
import {cameraPose,tileLayout,tileMotion} from '../lib/motion';
import {DEFAULT_PROJECT,type Project} from '../lib/model';
function roundedGeometry(w:number,h:number,r:number){const s=new Shape();const x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);const g=new ShapeGeometry(s,8);const pos=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/w+.5,pos.getY(i)/h+.5);return g;}
function Tile({url,index,count,project,onSelect,progress}:{url:string;index:number;count:number;project:Project;progress:number;onSelect?:(index:number)=>void}){
 const source=useTexture(url);const {x,y,z,w,h}=tileLayout(index,count);const tw=w*project.tileScale,th=h*project.tileScale;const motion=tileMotion(index,count,progress,project.template);
 const texture=useMemo(()=>{const map=source.clone();const image=source.image as {width:number;height:number};const aspect=image.width/image.height;const target=tw/th;if(aspect>target){map.repeat.x=target/aspect;map.offset.x=(1-map.repeat.x)/2;}else{map.repeat.y=aspect/target;map.offset.y=(1-map.repeat.y)/2;}map.needsUpdate=true;return map;},[source,tw,th]);
 const geometry=useMemo(()=>roundedGeometry(tw,th,Math.min(project.radius,tw/3,th/3)),[tw,th,project.radius]);
 useEffect(()=>()=>{geometry.dispose();texture.dispose();},[geometry,texture]);
 return <mesh position={[x*project.gap+motion.x,y*project.gap+motion.y,z+motion.z]} rotation={[motion.rx,motion.ry,motion.rz]} scale={motion.scale} geometry={geometry} onClick={onSelect?event=>{event.stopPropagation();onSelect(index);}:undefined}><meshBasicMaterial map={texture} toneMapped={false}/></mesh>;
}
class TileBoundary extends Component<{children:ReactNode;index:number;count:number},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}componentDidCatch(error:Error){if(getRemotionEnvironment().isRendering)cancelRender(error);}render(){if(!this.state.failed)return this.props.children;const p=tileLayout(this.props.index,this.props.count);return <mesh position={[p.x,p.y,p.z]}><planeGeometry args={[p.w,p.h]}/><meshBasicMaterial color="#643c50"/></mesh>;}}
export function PhotoWall({progress,project=DEFAULT_PROJECT,photoUrls,onSelect}:{progress:number;project?:Project;photoUrls?:string[];onSelect?:(index:number)=>void}){
 const urls=photoUrls??Array.from({length:36},(_,i)=>`/photos/${String(i+1).padStart(2,'0')}.jpg`);const pose=cameraPose(progress,project.template,urls.length);
 const wall=<><color attach="background" args={[project.background]}/><PerspectiveCamera makeDefault fov={52} position={[pose.x,pose.y,pose.z]} rotation={[0,0,pose.tilt]}/><group rotation={[.05,-.13,0]}>{urls.map((url,i)=><TileBoundary key={`${i}-${url}`} index={i} count={urls.length}><Tile progress={progress} url={url} index={i} count={urls.length} project={project} onSelect={onSelect}/></TileBoundary>)}</group></>;return getRemotionEnvironment().isRendering?<RenderAssetsReady urls={urls} progress={progress}>{wall}</RenderAssetsReady>:wall;
}




function RenderAssetsReady({urls,progress,children}:{urls:string[];progress:number;children:ReactNode}){const textures=useTexture(urls);const advance=useThree(s=>s.advance);useLayoutEffect(()=>{advance(0);},[progress,advance,textures]);return children;}

