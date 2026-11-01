'use client';
import {useRef,type KeyboardEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import SettingsAccount from './SettingsAccount';
import SettingsProduction from './SettingsProduction';
const tabs=[{id:'account',label:'계정 설정'},{id:'production',label:'제작 설정'}] as const;
type TabId=typeof tabs[number]['id'];
export default function SettingsTabs(){
 const params=useSearchParams(),refs=useRef<(HTMLButtonElement|null)[]>([]);
 const current:TabId=params.get('tab')==='production'?'production':'account';
 // Both panels stay mounted (hidden) so unsaved production edits survive a tab switch.
 // history.replaceState updates useSearchParams without a server round trip or remounting the page segment.
 function select(id:TabId){if(id===current)return;const url=new URL(window.location.href);url.searchParams.set('tab',id);window.history.replaceState(null,'',url);}
 function onKey(event:KeyboardEvent,index:number){
  const last=tabs.length-1,next=event.key==='ArrowRight'?(index===last?0:index+1):event.key==='ArrowLeft'?(index===0?last:index-1):event.key==='Home'?0:event.key==='End'?last:-1;
  if(next<0)return;event.preventDefault();refs.current[next]?.focus();select(tabs[next].id);
 }
 return <>
  <div className="settings-tabs" role="tablist" aria-label="환경설정 구분">{tabs.map((tab,index)=><button key={tab.id} ref={el=>{refs.current[index]=el;}} type="button" role="tab" id={`settings-tab-${tab.id}`} aria-controls={`settings-panel-${tab.id}`} aria-selected={current===tab.id} tabIndex={current===tab.id?0:-1} onClick={()=>select(tab.id)} onKeyDown={event=>onKey(event,index)}>{tab.label}</button>)}</div>
  {tabs.map(tab=><div key={tab.id} className="settings-tabpanel" role="tabpanel" id={`settings-panel-${tab.id}`} aria-labelledby={`settings-tab-${tab.id}`} tabIndex={0} hidden={current!==tab.id}>{tab.id==='account'?<SettingsAccount/>:<SettingsProduction/>}</div>)}
 </>;
}
