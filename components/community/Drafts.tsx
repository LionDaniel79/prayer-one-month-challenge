"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText, useResource } from "./shared";
export function Drafts({basePath}:{basePath:string}) {
  const router=useRouter();
  const [revision,setRevision]=useState(0);const [busy,setBusy]=useState("");const [message,setMessage]=useState("");
  const result=useResource<{items:{id:string;title:string}[]}>("/drafts",revision);
  if(!result.data?.items.length)return null;
  return <section className="card community-drafts"><h3>내 미완료 글</h3><p className="helper-text">전송이 중단된 글은 다른 회원에게 보이지 않습니다. 원래 작성 화면에서 다시 등록하거나, 내용을 확인한 뒤 삭제하고 다시 작성할 수 있습니다. 24시간이 지난 미완료 글은 정리됩니다.</p>
    {result.data.items.map(post=><div key={post.id} className="community-folder-edit"><Link href={`${basePath}?post=${post.id}`}>{post.title}</Link><button className="secondary-button danger-button" disabled={!!busy} onClick={async()=>{if(!window.confirm("이 미완료 글과 첨부를 삭제하시겠습니까?"))return;setBusy(post.id);setMessage("");try{const saved=await api<{id:string;published:boolean}>(`/drafts/${post.id}`,"DELETE");if(saved.published){router.push(`${basePath}?post=${saved.id}`);return;}setRevision(x=>x+1);}catch(error){setMessage(errorText(error));}finally{setBusy("");}}}>미완료 글 삭제</button></div>)}
    {message&&<p className="error-text" role="alert">{message}</p>}
  </section>;
}
