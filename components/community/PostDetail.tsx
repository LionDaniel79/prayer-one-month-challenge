"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { api, adminApi, displayDate, errorText, type Folder, type Post, type Viewer } from "./shared";
import { downloadFile } from "./transfer";
import { Comments } from "./Comments";
import { LikeButton } from "./LikeButton";
import { PostPhotos } from "./PostPhotos";
export function PostDetail({post,folders,user,admin=false,basePath,reload,onDeleted}:{post:Post;folders:Folder[];user:Viewer;admin?:boolean;basePath:string;reload:()=>void;onDeleted:()=>void}) {
  const [target,setTarget]=useState(post.folderId),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[downloading,setDownloading]=useState("");
  const pending=useRef(false);const own=post.authorId===user.id;
  async function act(work:()=>Promise<unknown>,done:()=>void){if(pending.current)return;pending.current=true;setBusy(true);setMessage("");try{await work();done();}catch(error){setMessage(errorText(error));}finally{pending.current=false;setBusy(false);}}
  return <>
    <article className="card community-post"><Link href={`${basePath}?folder=${post.folderId}`}>← {post.folderName} 목록</Link><h3 className="community-post-title">{post.title}</h3><p className="community-post-meta"><strong>{post.authorName}</strong><time dateTime={post.publishedAt??post.createdAt}>{displayDate(post.publishedAt??post.createdAt)}</time>{!post.publishedAt&&<span>아직 등록되지 않은 글</span>}</p>
      <PostPhotos postId={post.id} files={post.files}/>
      <div className="community-body">{post.body}</div>
      {post.files.length>0&&<section className="community-attachments" aria-label="첨부파일"><h4>첨부파일 {post.files.length}개</h4>{post.files.map(file=><button className="community-download" key={file.slot} disabled={Boolean(downloading)} onClick={async()=>{setDownloading(file.name);setMessage("");try{await downloadFile(post.id,file);}catch(error){setMessage(errorText(error));}finally{setDownloading("");}}}><span>{file.name}</span><small>{(file.size/1024/1024).toFixed(2)}MB · 다운로드</small></button>)}{downloading&&<p role="status">{downloading} 내려받는 중…</p>}</section>}
      {post.publishedAt&&<LikeButton postId={post.id} initialLiked={post.liked} initialCount={post.likeCount}/>}
      {!admin&&!post.publishedAt&&own&&<div><p className="helper-text">아직 다른 회원에게 보이지 않습니다. 첨부 전송을 마친 글은 등록을 마무리할 수 있습니다.</p><button className="primary-button" disabled={busy} onClick={()=>void act(()=>api(`/posts/${post.id}/publish`,"POST"),reload)}>등록 마무리</button></div>}
      {(admin||own)&&<div className="community-actions community-post-controls">{!admin&&own&&<Link className="secondary-button" href={`${basePath}?post=${post.id}&edit=1`}>게시글 수정</Link>}<button className="secondary-button danger-button" disabled={busy} onClick={()=>{if(window.confirm("게시글과 첨부파일, 댓글, 좋아요를 모두 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다."))void act(()=>admin?adminApi(`/posts/${post.id}`,"DELETE"):api(`/posts/${post.id}`,"DELETE"),onDeleted);}}>게시글 삭제</button></div>}
      {admin&&<form className="community-inline community-move" onSubmit={event=>{event.preventDefault();void act(()=>api(`/posts/${post.id}/move`,"PATCH",{folderId:target}),reload);}}><label>이동할 폴더<select value={target} disabled={busy} onChange={event=>setTarget(event.target.value)}>{folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><button className="primary-button" disabled={busy||target===post.folderId}>폴더로 이동</button></form>}
      {message&&<p className="error-text" role="alert">{message}</p>}
    </article>
    {post.publishedAt&&<Comments postId={post.id} user={user} admin={admin}/>}
  </>;
}
