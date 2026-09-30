"use client";
import { useEffect, useState } from "react";
import { periodLabel, requestState } from "../../src/features/pastoral/policy";
import { api, message, type Status } from "./client";
import { ReportEntry } from "./ReportEntry";
import { ReportDetail } from "./ReportDetail";
import { ReportHistory } from "./ReportHistory";
export function PastoralPortal({displayName}:{displayName:string}){
  const [status,setStatus]=useState<Status|null>(null);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const [samId,setSamId]=useState("");const [requestId,setRequestId]=useState("");const [viewId,setViewId]=useState("");const [refresh,setRefresh]=useState(0);const [additional,setAdditional]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    void api<Status>("/api/pastoral/status",{cache:"no-store",signal:controller.signal}).then(value=>{
      if(controller.signal.aborted)return;
      setStatus(value);setError("");
      setSamId(current=>value.sams.some(s=>s.id===current)?current:value.sams[0]?.id??"");
      setRequestId(current=>value.requests.some(r=>r.id===current)?current:value.requests.find(r=>requestState(r,false,value.today)==="pending")?.id??value.requests[0]?.id??"");
    }).catch(e=>{if(!controller.signal.aborted)setError(message(e));});
    return()=>controller.abort();
  },[refresh]);
  const sam=status?.sams.find(s=>s.id===samId);const request=status?.requests.find(r=>r.id===requestId);
  const completed=!!status?.completed.some(c=>c.requestId===requestId&&c.samId===samId);
  const state=request&&status?requestState(request,false,status.today):null;
  if(viewId)return <div className="pastoral"><ReportDetail key={viewId} id={viewId} onClose={()=>setViewId("")}/></div>;
  return <div className="pastoral"><header className="pastoral-toolbar"><div><h1>목양지 제출</h1><p>샘의 모임과 기도제목을 담당 목회자에게 전달합니다.</p></div><button type="button" onClick={()=>{setRefresh(n=>n+1);window.dispatchEvent(new Event("pastoral:changed"));}}>새로고침</button></header>
    {error&&<p role="alert" className="error-text">{error}</p>}{notice&&<p role="status" className="pastoral-success">{notice}</p>}
    {!status&&!error&&<p role="status">제출 요청을 불러오는 중입니다.</p>}
    {status&&!status.visible&&<p>목양지 제출은 관리자·마을장·리더만 이용할 수 있습니다.</p>}
    {status?.visible&&<>{status.count>0&&<p className="pastoral-attention" role="status">이번 달 미제출 목양지 {status.count}건이 있습니다.</p>}
      <section className="card"><h2>월별 제출 요청</h2>{!status.requests.length?<p>현재 등록된 월별 제출 요청이 없습니다.</p>:!status.sams.length?<p>제출할 샘이 없습니다. 관리자에게 소속을 확인해 주세요.</p>:<>
        <div className="pastoral-grid"><label>제출 대상 월<select value={requestId} onChange={e=>{setRequestId(e.target.value);setAdditional(false);setNotice("");}}>{status.requests.map(r=><option key={r.id} value={r.id}>{periodLabel(r)}</option>)}</select></label><label>제출할 샘<select value={samId} onChange={e=>{setSamId(e.target.value);setAdditional(false);setNotice("");}}>{status.sams.map(s=><option key={s.id} value={s.id}>{s.name}샘 · {s.leaderName||"리더 미등록"}</option>)}</select></label></div>
        {completed&&<p className="pastoral-success">이 달의 목양지는 제출 완료되었습니다.</p>}
        {state==="upcoming"&&<p>선택한 달이 시작되면 제출할 수 있습니다.</p>}{state==="closed"&&<p>이 달은 제출이 종료되었습니다. 제출 내역은 계속 확인할 수 있습니다.</p>}
        {state==="pending"&&completed&&!additional&&<button type="button" onClick={()=>setAdditional(true)}>이 달에 추가 제출</button>}
      </>}</section>
      {sam&&request&&state==="pending"&&(!completed||additional)&&<ReportEntry key={`${request.id}:${sam.id}:${refresh}`} request={request} sam={sam} today={status.today} displayName={displayName} onSubmitted={()=>{setNotice("목양지가 제출되었습니다.");setAdditional(false);setRefresh(n=>n+1);}}/>}
      <ReportHistory refresh={refresh} onView={setViewId}/>
    </>}
  </div>;
}
