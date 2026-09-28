"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
export type Viewer={id:string;role:string};
export type Folder={id:string;name:string;postCount:number};
export type Attachment={slot:number;name:string;size:number;sha256:string};
export type Post={id:string;folderId:string;folderName:string;title:string;body:string;authorId:string|null;authorName:string;createdAt:string;updatedAt:string;publishedAt:string|null;files:Attachment[];likeCount:number;liked:boolean};
export type PostSummary={id:string;title:string;authorName:string;createdAt:string;fileCount:number;commentCount:number;likeCount:number};
export type Comment={id:string;body:string;authorId:string|null;authorName:string;createdAt:string;updatedAt:string};
export type PageData<T>={items:T[];total:number;page:number;pageSize:number};
export const api=<T,>(path:string,method="GET",data?:unknown)=>fetchJson<T>("/api/community"+path,{method,...(data===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(data)})});
export function errorText(error:unknown):string {
  const code=error instanceof Error?error.message:"";
  const messages:Record<string,string>={UNAUTHORIZED:"로그인이 만료되었습니다. 다시 로그인해 주세요.",FORBIDDEN:"이 작업을 할 수 있는 권한이 없습니다.",POST_NOT_FOUND:"게시글을 찾을 수 없습니다.",FOLDER_NOT_FOUND:"폴더를 찾을 수 없습니다.",FOLDER_NOT_EMPTY:"글이 있는 폴더는 삭제할 수 없습니다. 작성 중인 글도 확인하고, 게시글은 다른 폴더로 옮겨 주세요.",LAST_FOLDER:"마지막 폴더는 삭제할 수 없습니다.",ALREADY_EXISTS:"같은 이름의 폴더가 이미 있습니다.",FILE_TOO_LARGE:"파일 한 개의 크기는 6MB 이하여야 합니다.",TOO_MANY_FILES:"첨부파일은 최대 2개까지 등록할 수 있습니다.",UNSUPPORTED_FILE:"실행 파일이나 웹 실행 문서는 첨부할 수 없습니다.",INVALID_FILENAME:"파일 이름에 사용할 수 없는 문자가 있습니다.",INVALID_FILE_SIZE:"빈 파일은 첨부할 수 없습니다.",UPLOAD_INCOMPLETE:"첨부파일 전송이 완료되지 않았습니다. 원래 작성 화면에서 재시도하거나 미완료 글을 삭제한 뒤 다시 작성해 주세요.",FILE_INTEGRITY_FAILED:"파일 확인에 실패했습니다. 다시 시도해 주세요.",TOO_MANY_DRAFTS:"미완료 글이 여러 개 있습니다. 커뮤니티 첫 화면의 미완료 글을 정리한 뒤 다시 시도해 주세요.",INVALID_INPUT:"입력 내용을 확인해 주세요.",DATA_CHANGED:"다른 화면에서 자료가 변경되었습니다. 새로고침 후 다시 시도해 주세요."};
  return messages[code]??"요청을 완료하지 못했습니다. 입력은 유지됩니다. 다시 시도해 주세요.";
}
export function useResource<T>(path:string|null,revision=0) {
  const [state,setState]=useState<{key:string;data:T|null;error:string}>({key:"",data:null,error:""});
  const key=`${path}:${revision}`;
  useEffect(()=>{
    if(!path) return;
    const controller=new AbortController();let active=true;
    fetchJson<T>("/api/community"+path,{signal:controller.signal}).then(data=>{if(active)setState({key,data,error:""});}).catch(error=>{if(active)setState({key,data:null,error:errorText(error)});});
    return()=>{active=false;controller.abort();};
  },[path,key]);
  return state.key===key?state:{key,data:null,error:""};
}
export function Loading(){return <p className="card" role="status">불러오는 중입니다…</p>;}
export function ErrorBox({message,retry}:{message:string;retry?:()=>void}){return <div className="card"><p className="error-text" role="alert">{message}</p>{retry&&<button className="secondary-button" onClick={retry}>다시 불러오기</button>}</div>;}
export function displayDate(value:string){return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));}
export function Pagination({page,total,pageSize,onPage}:{page:number;total:number;pageSize:number;onPage:(page:number)=>void}){
  const pages=Math.max(1,Math.ceil(total/pageSize));
  return <nav className="community-pagination" aria-label="목록 페이지"><button className="secondary-button" disabled={page<=1} onClick={()=>onPage(page-1)}>이전</button><span>{page} / {pages}</span><button className="secondary-button" disabled={page>=pages} onClick={()=>onPage(page+1)}>다음</button></nav>;
}
