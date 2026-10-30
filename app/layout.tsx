import AppTheme from '../components/AppTheme';
import type {ReactNode} from 'react';
import './globals.css';
import {Suspense} from 'react';
import GlobalNavigation from '../components/GlobalNavigation';
import MakerReferenceBar from '../components/MakerReferenceBar';
import AccountMenu from '../components/AccountMenu';
export const metadata={title:'Motion Studio',description:'웹·3D·영상 템플릿을 만드는 통합 모션 제작 스튜디오'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="ko" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{var p=JSON.parse(localStorage.getItem('motion-studio-production-settings-v1')||'null');document.documentElement.dataset.appTheme=p&&p.appTheme==='light'?'light':'black'}catch(e){document.documentElement.dataset.appTheme='black'}"}}/></head><body><AppTheme/><a className="skip-content" href="#workspace-content">콘텐츠로 건너뛰기</a><div className="app-frame"><Suspense fallback={<aside className="app-gnb" aria-label="메뉴 로딩">MOTION STUDIO</aside>}><GlobalNavigation/></Suspense><div className="app-content" id="workspace-content" tabIndex={-1}><header className="workspace-global-header"><MakerReferenceBar/><AccountMenu/></header>{children}</div></div></body></html>;}

