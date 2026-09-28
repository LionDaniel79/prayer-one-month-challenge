"use client";
import { useRef, useState } from "react";
import { api, errorText, type Folder } from "./shared";
export function FolderManager({folders,reload}:{folders:Folder[];reload:()=>void}) {
  const [name,setName]=useState(""),[editName,setEditName]=useState(""),[rename,setRename]=useState("");
  const [message,setMessage]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false);
  const pending=useRef(false);
  async function manage(action:()=>Promise<unknown>,ordered=false) {
    if(pending.current)return;pending.current=true;setBusy(true);setMessage("");setSuccess("");
    try{await action();setName("");setRename("");setSuccess(ordered?"게시판 순서를 저장했습니다.":"폴더 변경을 저장했습니다.");reload();}
    catch(error){setMessage(errorText(error));if(error instanceof Error && error.message==="FOLDER_ORDER_CHANGED")reload();}
    finally{pending.current=false;setBusy(false);}
  }
  function move(index:number,delta:number) {
    const expectedIds=folders.map(folder=>folder.id),ids=[...expectedIds];
    if(index+delta<0 || index+delta>=ids.length)return;
    [ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];
    void manage(()=>api("/folders/order","PATCH",{ids,expectedIds}),true);
  }
  return <details className="card community-folder-management"><summary>폴더 관리</summary>
    <form className="community-inline" onSubmit={event=>{event.preventDefault();void manage(()=>api("/folders","POST",{name}));}}><label>새 폴더 이름<input value={name} onChange={event=>setName(event.target.value)} maxLength={60} required disabled={busy}/></label><button className="primary-button" disabled={busy||!name.trim()}>폴더 생성</button></form>
    <p className="helper-text">위·아래 버튼으로 게시판 순서를 바꿉니다. 글이 없는 폴더만 삭제할 수 있습니다.</p>
    {folders.map((item,index)=><div key={item.id} className="community-folder-edit"><strong>{index+1}. {item.name}</strong><span className="community-actions">
      <button className="secondary-button" aria-label={`${item.name} 위로`} disabled={busy||index===0} onClick={()=>move(index,-1)}>↑ 위로</button>
      <button className="secondary-button" aria-label={`${item.name} 아래로`} disabled={busy||index===folders.length-1} onClick={()=>move(index,1)}>↓ 아래로</button>
      <button className="secondary-button" disabled={busy} onClick={()=>{setRename(item.id);setEditName(item.name);}}>이름 변경</button>
      <button className="secondary-button danger-button" disabled={busy||folders.length===1} onClick={()=>{if(window.confirm(`“${item.name}” 폴더를 삭제하시겠습니까?`))void manage(()=>api(`/folders/${item.id}`,"DELETE"));}}>폴더 삭제</button>
    </span>{rename===item.id&&<form className="community-inline" onSubmit={event=>{event.preventDefault();void manage(()=>api(`/folders/${item.id}`,"PATCH",{name:editName}));}}><label>변경할 폴더 이름<input value={editName} onChange={event=>setEditName(event.target.value)} maxLength={60} required disabled={busy}/></label><button className="primary-button" disabled={busy||!editName.trim()}>변경 저장</button></form>}</div>)}
    {message&&<p className="error-text" role="alert">{message}</p>}{success&&<p className="helper-text" role="status">{success}</p>}
  </details>;
}
