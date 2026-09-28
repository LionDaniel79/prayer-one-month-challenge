"use client";
import { useRef, useState, type FormEvent } from "react";
import { api, displayDate, ErrorBox, errorText, Loading, Pagination, useResource, type Comment, type PageData, type Viewer } from "./shared";
export function Comments({postId,user}:{postId:string;user:Viewer}) {
  const [revision,setRevision]=useState(0);const [page,setPage]=useState(1);const [body,setBody]=useState("");
  const [editing,setEditing]=useState("");const [editBody,setEditBody]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  const submitted=useRef({id:"",body:""});const pending=useRef(false);
  const resource=useResource<PageData<Comment>>(`/posts/${postId}/comments?page=${page}`,revision);
  async function action(work:()=>Promise<unknown>,done:()=>void){
    if(pending.current)return;pending.current=true;setBusy(true);setMessage("");
    try{await work();done();setRevision(value=>value+1);}catch(error){setMessage(errorText(error));}finally{pending.current=false;setBusy(false);}
  }
  function submit(event:FormEvent){event.preventDefault();const value=body.trim();if(!value)return;
    if(!submitted.current.id || submitted.current.body!==value)submitted.current={id:crypto.randomUUID(),body:value};
    void action(()=>api(`/posts/${postId}/comments`,"POST",submitted.current),()=>{setBody("");submitted.current={id:"",body:""};setPage(Math.max(1,Math.ceil(((resource.data?.total??0)+1)/50)));});
  }
  return <section className="card community-comments"><h3>댓글 {resource.data?.total??""}</h3>
    {resource.error?<ErrorBox message={resource.error} retry={()=>setRevision(value=>value+1)}/>:!resource.data?<Loading/>:<>
      {resource.data.items.length===0&&<p className="helper-text">첫 댓글을 남겨 주세요.</p>}
      {resource.data.items.map(comment=><article key={comment.id} className="community-comment"><header><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{displayDate(comment.createdAt)}</time></header>
        {editing===comment.id?<form onSubmit={event=>{event.preventDefault();void action(()=>api(`/comments/${comment.id}`,"PATCH",{body:editBody}),()=>setEditing(""));}}><label>댓글 수정<textarea rows={3} maxLength={2000} required value={editBody} onChange={event=>setEditBody(event.target.value)} disabled={busy}/></label><div className="community-actions"><button className="primary-button" disabled={busy||!editBody.trim()}>댓글 수정 저장</button><button type="button" className="secondary-button" onClick={()=>setEditing("")} disabled={busy}>취소</button></div></form>:<p className="community-body">{comment.body}</p>}
        {(comment.authorId===user.id||user.role==="admin")&&editing!==comment.id&&<div className="community-actions"><button className="secondary-button" disabled={busy} onClick={()=>{setEditing(comment.id);setEditBody(comment.body);}}>댓글 수정</button><button className="secondary-button danger-button" disabled={busy} onClick={()=>{if(window.confirm("이 댓글을 삭제하시겠습니까?"))void action(()=>api(`/comments/${comment.id}`,"DELETE"),()=>setPage(1));}}>댓글 삭제</button></div>}
      </article>)}
      {resource.data.total>50&&<Pagination {...resource.data} onPage={setPage}/>}
    </>}
    <form onSubmit={submit} className="community-comment-form"><label>댓글 내용<textarea value={body} onChange={event=>setBody(event.target.value)} maxLength={2000} rows={3} disabled={busy} required placeholder="서로를 존중하는 따뜻한 이야기를 나눠 주세요."/></label><div className="community-actions"><span className="helper-text">{body.length} / 2,000</span><button className="primary-button" disabled={busy||!body.trim()}>댓글 등록</button></div></form>
    {message&&<p className="error-text" role="alert">{message}</p>}
  </section>;
}
