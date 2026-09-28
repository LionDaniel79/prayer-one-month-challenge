"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ErrorBox, Loading, useResource, type Folder, type Post, type Viewer } from "./shared";
import { FolderBoard } from "./FolderBoard";
import { PostDetail } from "./PostDetail";
import { PostEditor } from "./PostEditor";
import "./community.css";
export function CommunityClient({user,admin=false}:{user:Viewer;admin?:boolean}) {
  const params=useSearchParams();const router=useRouter();const [revision,setRevision]=useState(0);
  // Role alone must never turn the member interface into a management interface.
  const management=admin && user.role==="admin";
  const basePath=management?"/admin/community":"/community";
  const folderId=params.get("folder")??"",postId=params.get("post")??"";
  const folders=useResource<{folders:Folder[]}>("/folders",revision,true);
  const detail=useResource<{post:Post}>(postId?`/posts/${encodeURIComponent(postId)}`:null,revision);
  const reload=()=>setRevision(value=>value+1);
  const saved=(id:string)=>{reload();router.replace(`${basePath}?post=${id}`);};
  return <div className="shell community"><section className="feature-heading"><h2>{management?"커뮤니티 관리":"커뮤니티"}</h2><p>함께 나누는 소식과 이야기</p></section>
    {folders.error?<ErrorBox message={folders.error} retry={reload}/>:!folders.data?<Loading/>:postId?
      detail.error?<ErrorBox message={detail.error} retry={reload}/>:!detail.data?<Loading/>:!management && params.get("edit")==="1" && detail.data.post.authorId===user.id?
      <PostEditor key={`${postId}-${detail.data.post.version}`} post={detail.data.post} folderId={detail.data.post.folderId} folders={folders.data.folders} basePath={basePath} onSaved={saved}/>:
      <PostDetail key={`${postId}-${detail.data.post.version}`} post={detail.data.post} folders={folders.data.folders} user={user} admin={management} basePath={basePath} reload={reload} onDeleted={()=>{reload();router.replace(`${basePath}?folder=${detail.data!.post.folderId}`);}}/>:
      !management && params.get("new")==="1"?<PostEditor key={`new-${folderId}`} folders={folders.data.folders} folderId={folderId} basePath={basePath} onSaved={saved}/>:
      <FolderBoard key={folderId} folders={folders.data.folders} folderId={folderId} basePath={basePath} admin={management} reload={reload}/>
    }
  </div>;
}
