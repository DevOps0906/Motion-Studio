import type {ReactNode} from 'react';
import './globals.css';
export const metadata={title:'Motion Studio',description:'웹·3D·영상 템플릿을 만드는 통합 모션 제작 스튜디오'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="ko"><body>{children}</body></html>;}

