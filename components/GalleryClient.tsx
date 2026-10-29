"use client";
import dynamic from 'next/dynamic';
const MotionGallery=dynamic(()=>import('./MotionGallery'),{ssr:false,loading:()=> <div className="empty-state">3D 공간을 준비하고 있습니다…</div>});
export default function GalleryClient(){return <MotionGallery/>;}
