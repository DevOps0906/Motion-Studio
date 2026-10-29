import type {ReactNode} from 'react';
import './globals.css';
import {Suspense} from 'react';
import GlobalNavigation from '../components/GlobalNavigation';
import MakerReferenceBar from '../components/MakerReferenceBar';
export const metadata={title:'Motion Studio',description:'웹·3D·영상 템플릿을 만드는 통합 모션 제작 스튜디오'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="ko"><body><a className="skip-content" href="#workspace-content">콘텐츠로 건너뛰기</a><div className="app-frame"><Suspense fallback={<aside className="app-gnb" aria-label="메뉴 로딩">MOTION STUDIO</aside>}><GlobalNavigation/></Suspense><div className="app-content" id="workspace-content" tabIndex={-1}><MakerReferenceBar/>{children}</div></div></body></html>;}

