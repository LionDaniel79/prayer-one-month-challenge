"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { displayDate, ErrorBox, Loading, Pagination, useResource, type Folder, type PageData, type PostSummary } from "./shared";
import { Drafts } from "./Drafts";
import { FolderManager } from "./FolderManager";
export function FolderBoard({folders,folderId,basePath,admin=false,reload}:{folders:Folder[];folderId:string;basePath:string;admin?:boolean;reload:()=>void}) {
  const [revision,setRevision]=useState(0),[page,setPage]=useState(1),[query,setQuery]=useState(""),[search,setSearch]=useState("");
  const folder=folders.find(item=>item.id===folderId);
  const resource=useResource<PageData<PostSummary>>(folder?`/posts?folder=${folder.id}&page=${page}&q=${encodeURIComponent(search)}`:null,revision);
  function searchPosts(event:FormEvent){event.preventDefault();setSearch(query.trim());setPage(1);}
  return <>
    {admin&&<FolderManager folders={folders} reload={reload}/>}
    {!folderId?<><section className="community-folders" aria-label="커뮤니티 폴더">{folders.map(item=><Link className="card community-folder" key={item.id} href={`${basePath}?folder=${item.id}`}><span className="community-folder-heading"><span className="community-folder-symbol" aria-hidden="true">▤</span><strong title={item.name}>{item.name}</strong></span><span>게시글 {item.postCount}개 <span aria-hidden="true">→</span></span></Link>)}</section>{!admin&&<Drafts basePath={basePath}/>}</>:!folder?<ErrorBox message="폴더를 찾을 수 없습니다."/>:<section className="card community-board" aria-label={`${folder.name} 게시글 목록`}>
      <div className="community-toolbar"><div><Link href={basePath}>전체 폴더</Link><h3>{folder.name}</h3></div>{!admin&&<Link className="primary-button community-write" href={`${basePath}?folder=${folder.id}&new=1`}>글쓰기</Link>}</div>
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
