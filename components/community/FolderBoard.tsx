"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, displayDate, ErrorBox, errorText, Loading, Pagination, useResource, type Folder, type PageData, type PostSummary, type Viewer } from "./shared";
import { Drafts } from "./Drafts";
export function FolderBoard({folders,folderId,basePath,user,reload}:{folders:Folder[];folderId:string;basePath:string;user:Viewer;reload:()=>void}){
  const [revision,setRevision]=useState(0);const [page,setPage]=useState(1);const [query,setQuery]=useState("");const [search,setSearch]=useState("");
  const [name,setName]=useState("");const [editName,setEditName]=useState("");const [rename,setRename]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const folder=folders.find(item=>item.id===folderId);
  const resource=useResource<PageData<PostSummary>>(folder?`/posts?folder=${folder.id}&page=${page}&q=${encodeURIComponent(search)}`:null,revision);
  async function manage(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setMessage("");try{await action();setName("");setRename("");reload();}catch(error){setMessage(errorText(error));}finally{setBusy(false);}}
  function searchPosts(event:FormEvent){event.preventDefault();setSearch(query.trim());setPage(1);}
  return <>
    {user.role==="admin"&&<details className="card community-folder-management"><summary>폴더 관리</summary><form className="community-inline" onSubmit={event=>{event.preventDefault();void manage(()=>api("/folders","POST",{name}));}}><label>새 폴더 이름<input value={name} onChange={event=>setName(event.target.value)} maxLength={60} required disabled={busy}/></label><button className="primary-button" disabled={busy||!name.trim()}>폴더 생성</button></form>
      <p className="helper-text">게시글과 미완료 글이 없는 폴더만 삭제할 수 있습니다.</p>
      {folders.map(item=><div key={item.id} className="community-folder-edit"><strong>{item.name}</strong><span className="community-actions"><button className="secondary-button" disabled={busy} onClick={()=>{setRename(item.id);setEditName(item.name);}}>이름 변경</button><button className="secondary-button danger-button" disabled={busy} onClick={()=>{if(window.confirm(`“${item.name}” 폴더를 삭제하시겠습니까?`))void manage(()=>api(`/folders/${item.id}`,"DELETE"));}}>폴더 삭제</button></span>{rename===item.id&&<form className="community-inline" onSubmit={event=>{event.preventDefault();void manage(()=>api(`/folders/${item.id}`,"PATCH",{name:editName}));}}><label>변경할 폴더 이름<input value={editName} onChange={event=>setEditName(event.target.value)} maxLength={60} required disabled={busy}/></label><button className="primary-button" disabled={busy||!editName.trim()}>변경 저장</button></form>}</div>)}
    </details>}
    {message&&<p className="error-text" role="alert">{message}</p>}
    {!folderId?<><section className="community-folders" aria-label="커뮤니티 폴더">{folders.map(item=><Link className="card community-folder" key={item.id} href={`${basePath}?folder=${item.id}`}><span className="community-folder-symbol" aria-hidden="true">▤</span><strong>{item.name}</strong><span>게시글 {item.postCount}개 <span aria-hidden="true">→</span></span></Link>)}</section><Drafts basePath={basePath}/></>:!folder?<ErrorBox message="폴더를 찾을 수 없습니다."/>:<section className="card community-board" aria-label={`${folder.name} 게시글 목록`}>
      <div className="community-toolbar"><div><Link href={basePath}>전체 폴더</Link><h3>{folder.name}</h3></div><Link className="primary-button community-write" href={`${basePath}?folder=${folder.id}&new=1`}>글쓰기</Link></div>
      <form className="community-search" onSubmit={searchPosts}><label className="community-search-field">게시글 검색<input placeholder="제목 또는 내용" value={query} maxLength={100} onChange={event=>setQuery(event.target.value)}/></label><button className="secondary-button">검색</button></form>
      {resource.error?<ErrorBox message={resource.error} retry={()=>setRevision(value=>value+1)}/>:!resource.data?<Loading/>:<>
        <p className="helper-text">총 {resource.data.total}개의 게시글</p>
        <div className="community-list-head" aria-hidden="true"><span>제목</span><span>작성자</span><span>작성일</span></div>
        {resource.data.items.length===0&&<p className="helper-text">등록된 게시글이 없습니다.</p>}
        {resource.data.items.map(item=><Link className="community-post-row" key={item.id} href={`${basePath}?post=${item.id}`}><span className="community-row-title"><strong>{item.title}</strong><small>좋아요 {item.likeCount} · 댓글 {item.commentCount}{item.fileCount>0?` · 첨부 ${item.fileCount}`:""}</small></span><span>{item.authorName}</span><time dateTime={item.createdAt}>{displayDate(item.createdAt)}</time></Link>)}
        <Pagination {...resource.data} onPage={setPage}/>
      </>}
    </section>}
  </>;
}
