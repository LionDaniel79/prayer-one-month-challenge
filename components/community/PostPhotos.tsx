"use client";
import { useState } from "react";
import { isPhotoName } from "../../src/features/community/refinement-policy";
import type { Attachment } from "./shared";
import "./refinement.css";
function Photo({postId,file}:{postId:string;file:Attachment}) {
  const [failed,setFailed]=useState(false);
  return <div className="community-photo">{failed?<div className="helper-text" role="status">{file.name} 사진을 표시하지 못했습니다. 아래 첨부파일에서 원본을 내려받을 수 있습니다. <button className="secondary-button" onClick={()=>setFailed(false)}>사진 다시 불러오기</button></div>:
    // Authenticated, bounded and re-encoded by our image endpoint; never a public optimizer URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/community/posts/${postId}/files/${file.slot}/image?sha=${file.sha256}`} alt={file.name} decoding="async" onError={()=>setFailed(true)}/>
  }</div>;
}
export function PostPhotos({postId,files}:{postId:string;files:Attachment[]}) {
  const photos=files.filter(file=>isPhotoName(file.name));
  if(!photos.length)return null;
  return <section className="community-photos" aria-label="첨부 사진">{photos.map(file=><Photo key={`${file.slot}-${file.sha256}`} postId={postId} file={file}/>)}</section>;
}
