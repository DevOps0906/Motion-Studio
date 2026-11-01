'use client';
import {useEffect,useState} from 'react';
type Identity={name:string;email:string};
export default function SettingsAccount(){
 const [account,setAccount]=useState<Identity|null>(null),[operator,setOperator]=useState<boolean|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  fetch('/api/auth',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>setAccount(data.account)).catch(()=>setError('계정 정보를 확인하지 못했습니다.')).finally(()=>setLoading(false));
  // Operators only get 200 here; anyone else gets 403.
  fetch('/api/inquiries/unread',{cache:'no-store'}).then(r=>setOperator(r.status===200)).catch(()=>setOperator(false));
 },[]);
 async function logout(){setError('');try{const r=await fetch('/api/auth',{method:'DELETE'});if(!r.ok)throw Error();window.location.assign('/login');}catch{setError('로그아웃에 실패했습니다. 다시 시도하세요.');}}
 return <>
  <p className="settings-panel-intro">로그인한 계정과 권한을 확인합니다.</p>
  <section className="settings-section"><div><h2>계정 정보</h2><p>현재 로그인한 계정입니다.</p></div>
   {loading?<p role="status">계정 확인 중…</p>:account?<dl className="settings-account">
    <div><dt>이름</dt><dd>{account.name}</dd></div>
    <div><dt>이메일</dt><dd>{account.email}</dd></div>
    <div><dt>권한</dt><dd>{operator===null?'확인 중…':operator?'운영자':'일반 계정'}</dd></div>
   </dl>:<p><a href="/login">로그인</a>이 필요합니다.</p>}
  </section>
  <section className="settings-section"><div><h2>비밀번호</h2><p>화면에서는 비밀번호를 바꿀 수 없습니다.</p></div>
   <p className="settings-account-note">비밀번호 재설정은 서버 운영자가 <code>npm run account:create -- &lt;이메일&gt; --reset</code> 명령으로 진행합니다. 운영자에게 요청하세요.</p>
  </section>
  {operator&&<section className="settings-section"><div><h2>운영 메뉴</h2><p>운영자 계정에만 보입니다.</p></div>
   <div className="settings-links"><a href="/websites/inquiries">웹사이트 문의함</a><a href="/requirements-inbox">고객 개발요구사항 접수 내역</a></div>
  </section>}
  {account&&<div className="settings-actions"><button type="button" onClick={()=>void logout()}>로그아웃</button></div>}
  {error&&<p className="settings-message" role="alert">{error}</p>}
 </>;
}
