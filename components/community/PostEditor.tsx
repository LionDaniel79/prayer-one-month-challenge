"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { validateFiles } from "../../src/features/community/policy";
import { api, errorText, type Folder, type Post } from "./shared";
import { sha256, uploadFiles } from "./transfer";
export function PostEditor({folders,folderId,post,basePath,onSaved}:{folders:Folder[];folderId:string;post?:Post;basePath:string;onSaved:(id:string)=>void}) {
  const router=useRouter();
  const [title,setTitle]=useState(post?.title??"");const [body,setBody]=useState(post?.body??"");
  const [folder,setFolder]=useState(folderId||folders[0]?.id||"");const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [progress,setProgress]=useState(0);
  const id=useRef("");const pending=useRef(false);
  function selectFiles(input:HTMLInputElement){
    const selected=[...files,...Array.from(input.files??[])];
    try{validateFiles(selected.map(file=>({name:file.name,size:file.size,sha256:"0".repeat(64)})));setFiles(selected);setMessage("");}catch(error){setMessage(errorText(error));}
    input.value="";
  }
  async function submit(event:FormEvent){
    event.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setMessage("");setProgress(0);
    try{
      if(post){await api(`/posts/${post.id}`,"PUT",{title,body});onSaved(post.id);return;}
      if(!id.current)id.current=crypto.randomUUID();
      const metadata=await Promise.all(files.map(async file=>({name:file.name,size:file.size,sha256:await sha256(await file.arrayBuffer())})));
      const draft=await api<{id:string;published:boolean}>("/posts","POST",{id:id.current,folderId:folder,title,body,files:metadata});
      if(!draft.published){await uploadFiles(draft.id,files,setProgress);await api(`/posts/${draft.id}/publish`,"POST");}
      onSaved(draft.id);
    }catch(error){setMessage(errorText(error));}finally{pending.current=false;setBusy(false);}
  }
  async function cancel(){
    if(pending.current)return;
    if(!id.current){router.push(`${basePath}?folder=${folder}`);return;}
    if(!window.confirm("작성 중인 글과 전송한 첨부파일을 지우고 취소하시겠습니까?"))return;
    pending.current=true;setBusy(true);
    try{
      // Never delete a post whose publish response may have been lost.
      const saved=await api<{post:Post}>(`/posts/${id.current}`);
      if(saved.post.publishedAt){onSaved(id.current);return;}
      await api(`/posts/${id.current}`,"DELETE");router.push(`${basePath}?folder=${folder}`);
    }catch(error){setMessage(errorText(error));}finally{pending.current=false;setBusy(false);}
  }
  return <section className="card community-editor"><h3>{post?"게시글 수정":"글쓰기"}</h3><form onSubmit={submit}>
    <fieldset disabled={busy}>
      {!post&&<label>폴더<select value={folder} onChange={event=>setFolder(event.target.value)} required>{folders.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <label>제목<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={150} required /></label>
      <label>내용<textarea value={body} onChange={event=>setBody(event.target.value)} maxLength={20000} rows={10} required /></label>
      {!post&&<div className="community-file-picker"><label>첨부파일 (최대 2개, 파일당 6MB)<input type="file" multiple onChange={event=>selectFiles(event.currentTarget)}/></label><p className="helper-text">문서와 사진 등을 첨부할 수 있습니다. 실행 파일과 웹 실행 문서는 제외됩니다.</p>
      {files.map((file,index)=><div className="community-file-row" key={`${file.name}-${index}`}><span>{file.name} · {(file.size/1024/1024).toFixed(2)}MB</span><button type="button" className="secondary-button" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))} aria-label={`${file.name} 첨부 제거`}>제거</button></div>)}</div>}
      {post&&post.files.length>0&&<p className="helper-text">기존 첨부파일 {post.files.length}개는 그대로 유지됩니다.</p>}
    </fieldset>
    {message&&<p className="error-text" role="alert">{message}</p>}
    {busy&&<div role="status"><p>{post?"저장 중입니다…":`등록 중입니다… ${files.length>0?`첨부 전송 ${progress}%`:""}`}</p>{files.length>0&&<progress value={progress} max={100} aria-label="첨부 전송 진행률"/>}</div>}
    <div className="community-actions"><button type="submit" className="primary-button" disabled={busy||!title.trim()||!body.trim()||!folder}>{post?"수정 저장":busy?"등록 중…":"등록"}</button>{!busy&&(post?<Link href={`${basePath}?post=${post.id}`}>취소</Link>:<button type="button" className="secondary-button" onClick={()=>void cancel()}>취소</button>)}</div>
  </form></section>;
}
