import { CommunityError } from "./policy";
export function assertSameOrigin(request:Request) {
  const origin=request.headers.get("origin");
  if((origin && origin!==new URL(request.url).origin) || request.headers.get("sec-fetch-site")==="cross-site") throw new CommunityError("FORBIDDEN",403);
}
export async function readBytes(request:Request,limit:number):Promise<Buffer> {
  const length=request.headers.get("content-length");
  if(length!==null && (!/^\d+$/.test(length) || Number(length)>limit)) throw new CommunityError("PAYLOAD_TOO_LARGE",413);
  if(!request.body) return Buffer.alloc(0);
  const reader=request.body.getReader();const parts:Uint8Array[]=[];let total=0;
  try {
    for(;;) {
      const {done,value}=await reader.read();if(done) break;
      total+=value.byteLength;
      if(total>limit) {await reader.cancel();throw new CommunityError("PAYLOAD_TOO_LARGE",413);}
      parts.push(value);
    }
    return Buffer.concat(parts,total);
  } finally {reader.releaseLock();}
}
export async function readJson(request:Request):Promise<unknown> {
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new CommunityError("INVALID_CONTENT_TYPE",415);
  const body=await readBytes(request,128*1024);
  try{return JSON.parse(body.toString("utf8"));}catch{throw new CommunityError("INVALID_INPUT");}
}
