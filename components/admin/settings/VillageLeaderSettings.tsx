"use client";
import { useEffect, useState, type FormEvent } from "react";
import {LeaderIdentityChoice,useLeaderIdentity,leaderStateText} from "./LeaderIdentityChoice";
import type { VillageLeader } from "../../../src/features/pastoral/policy";
import { api, jsonBody, message } from "../../pastoral/client";
type Row=VillageLeader & {bindingState?:string};
const endpoint = "/api/admin/sams/village-leaders";
export function VillageLeaderSettings(){
  const [rows,setRows]=useState<Row[]>([]);const [editing,setEditing]=useState<Row|null>(null);
  const [name,setName]=useState("");const [leaderName,setLeaderName]=useState("");const identity=useLeaderIdentity("village",name,leaderName);
  function edit(row:Row|null){setEditing(row);setName(row?.name??"");setLeaderName(row?.leaderName??"");}
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  useEffect(()=>{const c=new AbortController();void api<{rows:Row[]}>(endpoint,{cache:"no-store",signal:c.signal}).then(v=>{if(!c.signal.aborted)setRows(v.rows);}).catch(e=>{if(!c.signal.aborted)setError(message(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[]);
  async function refresh(){const v=await api<{rows:Row[]}>(endpoint,{cache:"no-store"});setRows(v.rows);window.dispatchEvent(new Event("pastoral:changed"));}
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!identity.canSave)return;const form=event.currentTarget;const values=new FormData(form);setBusy(true);setError("");setNotice("");
    try{await api(endpoint,jsonBody("PUT",{name:String(values.get("name")??""),leaderName:String(values.get("leaderName")??""),isActive:values.get("isActive")==="on",leaderRosterId:identity.rosterId}));await refresh();edit(null);form.reset();setNotice("마을장 정보를 저장했습니다.");}catch(e){setError(message(e));}finally{setBusy(false);}
  }
  async function remove(row:VillageLeader){
    if(busy||!window.confirm(`${row.name} 등록을 삭제할까요? 회원과 제출한 목양지는 유지됩니다.`))return;setBusy(true);setError("");setNotice("");
    try{await api(endpoint,jsonBody("DELETE",{id:row.id}));await refresh();if(editing?.id===row.id)edit(null);setNotice("마을장 등록을 삭제했습니다.");}catch(e){setError(message(e));}finally{setBusy(false);}
  }
  return <section className="village-leaders" aria-label="마을장 관리"><h3>마을장 등록</h3><p className="helper-text">마을장 칸에 ‘1마을장’, 이름 칸에 성도 명단과 같은 이름을 입력하세요. 이름이 한 명이면 자동 연결하며, 동명이인이 있으면 소속과 전화번호 뒤 4자리를 보고 선택합니다. 한 번 연결한 성도는 고유 번호로 구분합니다. 마을장에게 다른 사람의 목양지 열람 권한은 부여하지 않습니다.</p>
    {error&&<p role="alert" className="error-text">{error}</p>}{notice&&<p role="status" className="success-text">{notice}</p>}
    {rows.some(row=>row.bindingState==="ambiguous")&&<p className="setting-warning" role="status">동명이인 확인이 필요한 마을장이 있습니다. 등록된 명단을 펼쳐 해당 마을장의 수정 버튼을 눌러 주세요.</p>}
    <details className="roster-disclosure"><summary>등록된 마을장 {rows.length}명 확인</summary>{loading?<p>불러오는 중…</p>:<ul className="sam-leader-list">{rows.map(row=><li key={row.id}><span><strong>{row.name}</strong> · {row.leaderName}{!row.isActive?" · 비활성":""} · {leaderStateText(row.bindingState)}</span><div className="header-actions"><button type="button" disabled={busy} aria-label={`${row.name} 수정`} onClick={()=>edit(row)}>수정</button><button type="button" disabled={busy} aria-label={`${row.name} 삭제`} onClick={()=>void remove(row)}>삭제</button></div></li>)}</ul>}</details>
    <form className="admin-form" key={editing?.id??"new-village-head"} onSubmit={save}><h4>{editing?"마을장 수정":"마을장 추가"}</h4>
      <label>마을장<input name="name" placeholder="예: 1마을장" maxLength={30} value={name} onChange={e=>setName(e.target.value)} readOnly={!!editing} required disabled={busy}/></label>
      <label>마을장 이름<input name="leaderName" placeholder="성도 명단에 등록된 이름" maxLength={100} value={leaderName} onChange={e=>setLeaderName(e.target.value)} required disabled={busy}/></label>
      <LeaderIdentityChoice identity={identity}/>
      <label className="checkbox-row"><input type="checkbox" name="isActive" defaultChecked={editing?.isActive??true} disabled={busy}/> 마을장 정보 사용</label>
      <div className="header-actions"><button type="submit" className="primary-button compact-button" disabled={busy||loading||!identity.canSave}>{busy?"저장 중…":"마을장 저장"}</button>{editing&&<button type="button" disabled={busy} onClick={()=>edit(null)}>취소</button>}</div>
    </form>
  </section>;
}
