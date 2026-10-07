"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { periodLabel, requestState, seoulToday, toggleMonth, type Period, type ReportRequest, type SamTarget } from "../../src/features/pastoral/policy";
import { api, jsonBody, message, type Summary } from "./client";
import { ReportDetail } from "./ReportDetail";
import { ReportHistory } from "./ReportHistory";
type Schedule = { year: number; currentYear: number; version: number; requests: ReportRequest[] };
function SchedulePanel({ onSaved }: { onSaved: (requests: ReportRequest[]) => void }) {
  const currentYear = Number(seoulToday().slice(0,4));
  const [year,setYear] = useState(currentYear);
  const [data,setData] = useState<Schedule | null>(null);
  const [selected,setSelected] = useState<Period[]>([]);
  const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [notice,setNotice] = useState(""); const [reload,setReload] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    void api<Schedule>(`/api/admin/pastoral/schedule?year=${year}`,{cache:"no-store",signal:c.signal}).then(value => {
      if (!c.signal.aborted) { setData(value); setSelected(value.requests.filter(r=>r.enabled).map(r=>({month:r.month}))); onSaved(value.requests); }
    }).catch(e=>{if(!c.signal.aborted)setError(message(e));});
    return ()=>c.abort();
  },[year,reload,onSaved]);
  async function save() {
    if(!data || busy)return; setBusy(true);setError("");setNotice("");
    try {
      const next = await api<Schedule>("/api/admin/pastoral/schedule",jsonBody("PUT",{year,expectedVersion:data.version,selected}));
      setData(next);onSaved(next.requests);setNotice("월별 제출 요청을 저장했습니다.");window.dispatchEvent(new Event("pastoral:changed"));
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }
  return <section className="card pastoral-schedule"><h2>월별 제출 요청</h2>
    <p>요청할 달을 누르면 선택되고, 다시 누르면 취소됩니다. 선택한 달 안에 사진·파일·직접 입력 중 하나로 1회 이상 제출하면 완료입니다.</p>
    <label>요청 연도<select value={year} disabled={busy} onChange={e=>{setData(null);setError("");setNotice("");setYear(Number(e.target.value));}}><option value={currentYear}>{currentYear}년 (올해)</option><option value={currentYear+1}>{currentYear+1}년 (내년)</option></select></label>
    {error&&<p role="alert" className="error-text">{error} <button type="button" onClick={()=>{setData(null);setError("");setNotice("");setReload(n=>n+1);}}>다시 불러오기</button></p>}
    {notice&&<p role="status" className="pastoral-success">{notice}</p>}
    {!data&&!error&&<p role="status">요청 설정을 불러오는 중입니다.</p>}
    {data&&<fieldset disabled={busy}><legend>{year}년 요청할 달</legend>
      <div className="pastoral-toolbar"><button type="button" onClick={()=>setSelected(Array.from({length:12},(_,i)=>({month:i+1})))}>모든 달 선택</button><button type="button" onClick={()=>setSelected([])}>전체 해제</button></div>
      <div className="pastoral-month-scroll" role="region" aria-label="1월부터 12월 요청 선택" tabIndex={0}><div className="pastoral-months">
        {Array.from({length:12},(_,i)=>i+1).map(month=><div className="pastoral-month" key={month}><button type="button" aria-label={`${month}월 제출 요청`} aria-pressed={selected.some(p=>p.month===month)} onClick={()=>setSelected(v=>toggleMonth(v,month))}>{month}월</button><small>{selected.some(p=>p.month===month)?"선택됨":"미선택"}</small></div>)}
      </div></div>
      <p className="helper-text">작은 화면에서는 달 선택 영역을 좌우로 움직이세요. 별도의 제출 기간은 없으며 해당 달의 첫날부터 말일까지 제출할 수 있습니다. 요청을 해제해도 제출본은 보존됩니다.</p>
      <button type="button" className="primary-button" onClick={save}>{busy?"저장 중…":"제출 요청 저장"}</button>
    </fieldset>}
  </section>;
}
type OverviewData={request:ReportRequest;label:string;rows:{sam:SamTarget;count:number;submitted:Pick<Summary,"id"|"leaderName"|"submittedBy"|"method"|"submittedAt">|null}[]};
function Overview({requestId,onView}:{requestId:string;onView:(id:string)=>void}){
  const [data,setData]=useState<OverviewData|null>(null);const [error,setError]=useState("");
  useEffect(()=>{const c=new AbortController();void api<OverviewData>(`/api/admin/pastoral/overview?requestId=${requestId}`,{cache:"no-store",signal:c.signal}).then(v=>{if(!c.signal.aborted)setData(v);}).catch(e=>{if(!c.signal.aborted)setError(message(e));});return()=>c.abort();},[requestId]);
  if(error)return <p role="alert" className="error-text">{error}</p>;
  if(!data)return <p role="status">제출 현황을 불러오는 중입니다.</p>;
  return <div className="pastoral-overview"><p><strong>{data.label}</strong> · 제출 {data.rows.filter(r=>r.submitted).length} / 대상 {data.rows.length}샘</p>
    <details className="pastoral-targets"><summary>제출 대상 {data.rows.length}샘 · 명단 펼치기/접기</summary><div className="pastoral-report-list">{data.rows.map(({sam,submitted,count})=><article key={sam.id}><div><strong>{sam.name}샘 · {submitted?.leaderName||sam.leaderName||"리더 미등록"}</strong>{submitted?<p>제출 완료 ({count}건) · {submitted.submittedBy}</p>:<p className="pastoral-attention">{requestState(data.request,false)==="upcoming"?"요청 월 시작 전":!data.request.enabled?"요청 해제":"미제출"}</p>}</div>{submitted&&<div className="pastoral-row-actions"><button type="button" onClick={()=>onView(submitted.id)}>최근 목양지 보기</button>{submitted.method==="form"&&<a href={`/api/pastoral/reports/${submitted.id}/txt`} download>TXT 내려받기</a>}</div>}</article>)}</div></details>
  </div>;
}
export function PastoralAdmin({initialId="",initialUnreviewed=false}:{initialId?:string;initialUnreviewed?:boolean}){
  const [requests,setRequests]=useState<ReportRequest[]>([]);const [requestId,setRequestId]=useState("");const [viewId,setViewId]=useState(initialId);const [refresh,setRefresh]=useState(0);
  const saved=useCallback((next:ReportRequest[])=>{setRequests(next);setRequestId(current=>next.some(r=>r.id===current)?current:next.find(r=>requestState(r,false)==="pending")?.id??next[0]?.id??"");setRefresh(n=>n+1);},[]);
  if(viewId)return <div className="pastoral"><ReportDetail key={viewId} id={viewId} admin onChanged={()=>{setRefresh(n=>n+1);window.dispatchEvent(new Event("pastoral:changed"));}} onClose={()=>{setViewId("");setRefresh(n=>n+1);}}/></div>;
  return <div className="pastoral"><header className="pastoral-toolbar"><div><h1>목양지 관리</h1><p>월별 요청과 샘별 제출 현황을 확인합니다. 마을장·샘리더 등록은 <Link href="/admin/users">사용자 관리 → 샘 리더 관리</Link>에서 합니다.</p></div><Link href="/pastoral-reports">제출 화면으로</Link></header>
    <SchedulePanel onSaved={saved}/>
    <section className="card"><div className="pastoral-toolbar"><h2>샘별 제출 현황</h2><button type="button" onClick={()=>setRefresh(n=>n+1)}>현황 새로고침</button></div>{requests.length?<><label>확인할 월<select value={requestId} onChange={e=>setRequestId(e.target.value)}>{requests.map(r=><option key={r.id} value={r.id}>{periodLabel(r)}{!r.enabled?" · 요청 해제":""}</option>)}</select></label>{requestId&&<Overview key={`${requestId}:${refresh}`} requestId={requestId} onView={setViewId}/>}</>:<p>월별 제출 요청을 저장하면 현황이 표시됩니다.</p>}</section>
    <ReportHistory admin initialUnreviewed={initialUnreviewed} refresh={refresh} onView={setViewId}/>
  </div>;
}
