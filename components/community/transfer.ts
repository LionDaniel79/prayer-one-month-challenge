import { CHUNK_BYTES, expectedChunkSize } from "../../src/features/community/policy";
import { fetchJson } from "../../src/lib/fetch-json";
import type { Attachment } from "./shared";
export async function sha256(data:ArrayBuffer):Promise<string> {
  const hash=await crypto.subtle.digest("SHA-256",data);
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,"0")).join("");
}
export async function uploadFiles(id:string,files:File[],progress:(value:number)=>void) {
  const total=files.reduce((sum,file)=>sum+file.size,0);let sent=0;
  for(let slot=0;slot<files.length;slot++) {
    const file=files[slot];
    for(let start=0,index=0;start<file.size;start+=CHUNK_BYTES,index++) {
      const body=file.slice(start,start+CHUNK_BYTES);
      await fetchJson(`/api/community/posts/${id}/files/${slot}/chunks/${index}`,{method:"PUT",headers:{"content-type":"application/octet-stream"},body});
      sent+=body.size;progress(Math.round(sent/total*100));
    }
  }
}
export async function downloadFile(postId:string,file:Attachment):Promise<void> {
  const chunks:Uint8Array<ArrayBuffer>[]=[];
  for(let index=0;index<Math.ceil(file.size/CHUNK_BYTES);index++) {
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch(`/api/community/posts/${postId}/files/${file.slot}/chunks/${index}`,{signal:controller.signal});
      if(!response.ok) throw new Error((await response.json().catch(()=>({}))).code??"DOWNLOAD_FAILED");
      const data=new Uint8Array(await response.arrayBuffer());
      if(data.byteLength!==expectedChunkSize(file.size,index)) throw new Error("FILE_INTEGRITY_FAILED");
      chunks.push(data);
    }finally{clearTimeout(timer);}
  }
  const blob=new Blob(chunks,{type:"application/octet-stream"});
  if(blob.size!==file.size || await sha256(await blob.arrayBuffer())!==file.sha256) throw new Error("FILE_INTEGRITY_FAILED");
  const url=URL.createObjectURL(blob);const link=document.createElement("a");
  link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
