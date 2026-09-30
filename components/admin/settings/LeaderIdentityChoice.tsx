"use client";
import styles from "./leader-identity.module.css";
import { useEffect, useState } from "react";
import { fetchJson } from "../../../src/lib/fetch-json";
import type { IdentityResolution } from "../../../src/features/sams/identity-service";

export function useLeaderIdentity(kind:"sam"|"village", name:string, leaderName:string){
  const key=JSON.stringify([kind,name,leaderName]);
  const [reply,setReply]=useState<{key:string;value:IdentityResolution}|null>(null);
  const [failure,setFailure]=useState<{key:string;message:string}|null>(null);
  const [choice,setChoice]=useState<{key:string;id:string}|null>(null);
  useEffect(()=>{
    if(!name.trim()||!leaderName.trim())return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      void fetchJson<IdentityResolution>("/api/admin/sams/resolve-leader",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,name,leaderName}),signal:controller.signal})
        .then(value=>{if(!controller.signal.aborted){setReply({key,value});setChoice({key,id:value.rosterId??""});setFailure(null);}})
        .catch(()=>{if(!controller.signal.aborted)setFailure({key,message:"성도 명단을 확인하지 못했습니다. 이름을 다시 입력하거나 새로고침해 주세요."});});
    },250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[kind,name,leaderName,key]);
  const data=reply?.key===key?reply.value:null;
  const selected=choice?.key===key?choice.id:"";
  const error=failure?.key===key?failure.message:"";
  const ready=!!data&&!error;
  return {kind,data,error,selected,loading:!!name.trim()&&!!leaderName.trim()&&!ready&&!error,
    canSave:ready&&(data!.state!=="ambiguous"||!!selected),
    choose:(id:string)=>setChoice({key,id}),
    rosterId:data&&(data.candidateCount>1||data.state==="unavailable")?selected||undefined:undefined};
}
export function LeaderIdentityChoice({identity}:{identity:ReturnType<typeof useLeaderIdentity>}){
  if(identity.error)return <p role="alert" className="error-text">{identity.error}</p>;
  if(identity.loading)return <p className="helper-text" role="status">성도 명단 확인 중…</p>;
  const data=identity.data;if(!data)return null;
  const selected=data.candidates.find(p=>p.id===identity.selected);
  return <div className={styles.choice}>
    {data.candidateCount>1?<fieldset><legend>동명이인 확인</legend><p className="helper-text">같은 이름의 성도 {data.candidateCount}명입니다. 소속과 전화번호 뒤 4자리를 확인해 한 분을 선택하세요. {identity.kind==="village"?"마을장은 소속 마을과 관계없이 지정할 수 있으며, 목양지 권한은 담당 마을에 적용됩니다.":"샘리더는 해당 샘에 소속된 성도만 지정할 수 있습니다."}</p>
      {data.candidates.map(person=><label key={person.id} className="checkbox-row"><input type="radio" name="leaderIdentity" value={person.id} checked={identity.selected===person.id} disabled={!person.eligible} onChange={()=>identity.choose(person.id)}/><span>{person.name} · {person.village} · {person.sam}샘 · {person.phoneSuffix?`****-${person.phoneSuffix}`:"전화번호 확인 불가"}{!person.eligible?" · 소속 불일치":""}<small className="helper-text"> (명단 {person.id.slice(0,8)})</small></span></label>)}
    </fieldset>:data.state==="linked"?<p className="helper-text">{selected?`${selected.name} · ${selected.village} · ${selected.sam}샘`:"지정된 성도"} — 자동 연결됩니다. 별도 선택은 필요 없습니다.</p>:<p className="setting-warning">{data.state==="unavailable"?"이전에 연결한 성도의 명단·소속을 확인해 주세요. 다른 동명이인에게 자동으로 권한을 넘기지 않습니다.":"이 이름과 소속에 맞는 성도가 없습니다. 이름 정보만 저장되며, 명단을 확인하기 전에는 권한이 부여되지 않습니다."}</p>}
    {data.state==="unavailable"&&data.candidateCount===1&&data.candidates[0]?.eligible&&<button type="button" className="text-button" onClick={()=>{if(window.confirm("이전에 연결한 명단을 사용할 수 없습니다. 현재 표시된 성도로 다시 연결할까요?"))identity.choose(data.candidates[0].id);}}>현재 성도로 연결 확인</button>}
  </div>;
}
export function leaderStateText(state?:string){return ({linked:"연결됨",ambiguous:"동명이인 확인 필요",unmatched:"명단 확인 필요",unavailable:"기존 연결 확인 필요"} as Record<string,string>)[state??""]??"";}
