'use client';
import {useState} from 'react';
export default function RequirementsLinkButton(){
 const [notice,setNotice]=useState(''),[fallback,setFallback]=useState('');
 async function copy(){const url=new URL('/website-requirements',location.origin).href;try{await navigator.clipboard.writeText(url);setFallback('');setNotice(['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'링크를 복사했습니다. 외부 고객에게는 공개 배포 주소를 전달하세요.':'개발요구사항 링크를 복사했습니다. 고객에게 전달해 주세요.');}catch{setFallback(url);setNotice('주소를 선택해 복사해 주세요.');}}
 return <div className="requirements-link-control"><button type="button" onClick={()=>void copy()}>개발요구사항 링크 복사</button>{notice&&<span role="status">{notice}</span>}{fallback&&<input aria-label="개발요구사항 주소" readOnly value={fallback} onFocus={e=>e.target.select()}/>}</div>;
}
