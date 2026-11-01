import {Suspense} from 'react';
import SettingsTabs from '../../components/SettingsTabs';
export default function SettingsPage(){
 return <main className="settings-page"><header><span className="eyebrow">WORKSPACE / SETTINGS</span><h1>환경설정</h1><p>계정 정보와 제작 기본값을 관리합니다.</p></header><Suspense fallback={<p role="status">환경설정을 불러오는 중…</p>}><SettingsTabs/></Suspense></main>;
}
