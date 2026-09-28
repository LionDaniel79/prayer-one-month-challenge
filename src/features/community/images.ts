import { createHash } from "node:crypto";
import sharp from "sharp";
import { getDb, rows, sql } from "./db";
import { CommunityError, expectedChunkSize, type Actor } from "./policy";
import { isPhotoName } from "./refinement-policy";
function rasterSignature(data:Buffer) {
  const hex=data.subarray(0,8).toString("hex"),head=data.subarray(0,32).toString("ascii");
  return hex.startsWith("ffd8ff") || hex==="89504e470d0a1a0a" || /^GIF8[79]a/.test(head) || (head.startsWith("RIFF") && head.slice(8,12)==="WEBP") || /^(49492a00|4d4d002a|49492b00|4d4d002b)/.test(hex) || (head.slice(4,8)==="ftyp" && /avif|avis|heic|heix|hevc|hevx|mif1|msf1/.test(head.slice(8)));
}
export async function photoPreview(user:Actor,postId:string,slot:number,expectedHash:string|null) {
  // One MVCC snapshot: an attachment replacement cannot mix old metadata/new chunks.
  const [file]=await rows<{name:string;size:number;sha256:string;chunks:Buffer[];indices:number[]}>(getDb(),sql`select f.name,f.size,f.sha256,array_agg(c.data order by c.chunk_index) as chunks,array_agg(c.chunk_index order by c.chunk_index) as indices from prayer_app.community_files f join prayer_app.community_posts p on p.id=f.post_id join prayer_app.community_file_chunks c on c.post_id=f.post_id and c.slot=f.slot where f.post_id=${postId} and f.slot=${slot} and (p.published_at is not null or p.author_user_id=${user.id}) group by f.post_id,f.slot,f.name,f.size,f.sha256`);
  if(!file)throw new CommunityError("FILE_NOT_FOUND",404);
  if(expectedHash && file.sha256!==expectedHash)throw new CommunityError("DATA_CHANGED",409);
  if(!isPhotoName(file.name))throw new CommunityError("UNSUPPORTED_IMAGE",415);
  for(let i=0;i<file.chunks.length;i++)if(file.indices[i]!==i || file.chunks[i].length!==expectedChunkSize(file.size,i))throw new CommunityError("FILE_INTEGRITY_FAILED",409);
  const data=Buffer.concat(file.chunks);
  if(data.length!==file.size || createHash("sha256").update(data).digest("hex")!==file.sha256)throw new CommunityError("FILE_INTEGRITY_FAILED",409);
  // Do not hand SVG/XML/HTML (even renamed .png) to an inline renderer.
  if(!rasterSignature(data))throw new CommunityError("UNSUPPORTED_IMAGE",415);
  try {
    const image=sharp(data,{limitInputPixels:64000000,failOn:"warning"});
    const metadata=await image.metadata();
    if(!metadata.format || !["jpeg","png","webp","gif","avif","heif","tiff"].includes(metadata.format))throw new Error("UNSUPPORTED_IMAGE");
    const output=await image.rotate().resize({width:1920,height:1920,fit:"inside",withoutEnlargement:true}).webp({quality:80}).toBuffer();
    if(output.length>3*1024*1024)throw new Error("PREVIEW_TOO_LARGE");
    return output;
  }catch{throw new CommunityError("UNSUPPORTED_IMAGE",415);}
}
