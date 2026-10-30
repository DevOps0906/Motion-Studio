'use client';
import {useEffect,useState} from 'react';
type Identity={name:string;email:string};
export default function AccountMenu(){
 const [account,setAccount]=useState<Identity|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/auth',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>setAccount(data.account)).catch(()=>setError('계정 확인 실패')).finally(()=>setLoading(false));},[]);
 async function logout(){setError('');try{const r=await fetch('/api/auth',{method:'DELETE'});if(!r.ok)throw Error();window.location.assign('/login');}catch{setError('로그아웃에 실패했습니다. 다시 시도하세요.');}}
 return <div className="account-menu">{loading?<span role="status">계정 확인 중…</span>:account?<details><summary aria-label={`로그인 계정 ${account.name}`}><span className="account-avatar" aria-hidden="true">{account.name.slice(0,1)}</span><span>{account.name}</span></summary><div className="account-popover"><strong>{account.name}</strong><span>{account.email}</span><button onClick={()=>void logout()}>로그아웃</button></div></details>:<a className="button" href="/login">로그인</a>}{error&&<span role="alert">{error}</span>}</div>;
}
