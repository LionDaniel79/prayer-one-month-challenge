"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { VillageLeader } from "../../../src/features/pastoral/policy";
import { api, jsonBody, message } from "../../pastoral/client";
const endpoint = "/api/admin/sams/village-leaders";
export function VillageLeaderSettings(){
  const [rows,setRows]=useState<VillageLeader[]>([]);const [editing,setEditing]=useState<VillageLeader|null>(null);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  useEffect(()=>{const c=new AbortController();void api<{rows:VillageLeader[]}>(endpoint,{cache:"no-store",signal:c.signal}).then(v=>{if(!c.signal.aborted)setRows(v.rows);}).catch(e=>{if(!c.signal.aborted)setError(message(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[]);
  async function refresh(){const v=await api<{rows:VillageLeader[]}>(endpoint,{cache:"no-store"});setRows(v.rows);window.dispatchEvent(new Event("pastoral:changed"));}
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;const form=event.currentTarget;const values=new FormData(form);setBusy(true);setError("");setNotice("");
    try{await api(endpoint,jsonBody("PUT",{name:String(values.get("name")??""),leaderName:String(values.get("leaderName")??""),isActive:values.get("isActive")==="on"}));await refresh();setEditing(null);form.reset();setNotice("마을장 정보를 저장했습니다.");}catch(e){setError(message(e));}finally{setBusy(false);}
  }
  async function remove(row:VillageLeader){
    if(busy||!window.confirm(`${row.name} 등록을 삭제할까요? 회원과 제출한 목양지는 유지됩니다.`))return;setBusy(true);setError("");setNotice("");
    try{await api(endpoint,jsonBody("DELETE",{id:row.id}));await refresh();if(editing?.id===row.id)setEditing(null);setNotice("마을장 등록을 삭제했습니다.");}catch(e){setError(message(e));}finally{setBusy(false);}
  }
  return <section className="village-leaders" aria-label="마을장 관리"><h3>마을장 등록</h3><p className="helper-text">마을장 칸에 ‘1마을장’, 이름 칸에 성도 명단과 같은 이름을 입력하세요. 같은 마을의 원래 이름 또는 로그인 이름으로 한 명만 확인되면 목양지 메뉴가 자동으로 표시됩니다. 마을장에게 다른 사람의 목양지 열람 권한은 부여하지 않습니다.</p>
    {error&&<p role="alert" className="error-text">{error}</p>}{notice&&<p role="status" className="success-text">{notice}</p>}
    <details className="roster-disclosure"><summary>등록된 마을장 {rows.length}명 확인</summary>{loading?<p>불러오는 중…</p>:<ul className="sam-leader-list">{rows.map(row=><li key={row.id}><span><strong>{row.name}</strong> · {row.leaderName}{!row.isActive?" · 비활성":""}</span><div className="header-actions"><button type="button" disabled={busy} aria-label={`${row.name} 수정`} onClick={()=>setEditing(row)}>수정</button><button type="button" disabled={busy} aria-label={`${row.name} 삭제`} onClick={()=>void remove(row)}>삭제</button></div></li>)}</ul>}</details>
    <form className="admin-form" key={editing?.id??"new-village-head"} onSubmit={save}><h4>{editing?"마을장 수정":"마을장 추가"}</h4>
      <label>마을장<input name="name" placeholder="예: 1마을장" maxLength={30} defaultValue={editing?.name??""} readOnly={!!editing} required disabled={busy}/></label>
      <label>마을장 이름<input name="leaderName" placeholder="성도 명단에 등록된 이름" maxLength={100} defaultValue={editing?.leaderName??""} required disabled={busy}/></label>
      <label className="checkbox-row"><input type="checkbox" name="isActive" defaultChecked={editing?.isActive??true} disabled={busy}/> 마을장 정보 사용</label>
      <div className="header-actions"><button type="submit" className="primary-button compact-button" disabled={busy||loading}>{busy?"저장 중…":"마을장 저장"}</button>{editing&&<button type="button" disabled={busy} onClick={()=>setEditing(null)}>취소</button>}</div>
    </form>
  </section>;
}
