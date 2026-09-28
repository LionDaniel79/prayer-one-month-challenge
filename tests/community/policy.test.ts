import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, CHUNK_BYTES, validateFiles, expectedChunkSize, assertEditor, assertManager, parsePostInput, parseFolderName, parseCommentBody, parseLikeInput, pageNumber } from "../../src/features/community/policy";
import { assertSameOrigin, readBytes, readJson } from "../../src/features/community/http";
const file=(size=MAX_FILE_BYTES)=>({name:"자료.pdf",size,sha256:"a".repeat(64)});
const id="10000000-0000-4000-8000-000000000001";
describe("community limits and authorization",()=>{
  it("accepts two files at exactly six MB, never three",()=>{expect(MAX_FILE_BYTES).toBe(6291456);expect(validateFiles([file(),file()])).toHaveLength(2);expect(()=>validateFiles([file(),file(),file()])).toThrow("TOO_MANY_FILES");});
  it("rejects oversize and invalid file sizes",()=>{expect(()=>validateFiles([file(MAX_FILE_BYTES+1)])).toThrow("FILE_TOO_LARGE");for(const size of [0,-1,1.5,NaN])expect(()=>validateFiles([file(size)])).toThrow();});
  it("rejects unsafe file names without trusting a client MIME type",()=>{for(const name of ["../file.pdf","a\\b.pdf","bad\nname.txt","a.exe","a.HTML","a.svg"])expect(()=>validateFiles([{...file(),name}])).toThrow();});
  it("pins chunk limits and short final chunk",()=>{expect(expectedChunkSize(MAX_FILE_BYTES,11)).toBe(CHUNK_BYTES);expect(expectedChunkSize(CHUNK_BYTES+1,1)).toBe(1);for(const i of [-1,12,1.5])expect(()=>expectedChunkSize(MAX_FILE_BYTES,i)).toThrow();});
  it("rejects non-admin management and editing other members' content",()=>{expect(()=>assertManager({id,role:"member"})).toThrow("FORBIDDEN");expect(()=>assertEditor({id,role:"member"},"other")).toThrow("FORBIDDEN");expect(()=>assertEditor({id,role:"member"},id)).not.toThrow();expect(()=>assertEditor({id,role:"admin"},null)).not.toThrow();});
  it("validates every post field and normalizes text",()=>{const post={id,folderId:id,title:" 제목 ",body:" 내용 ",files:[]};expect(parsePostInput(post).title).toBe("제목");for(const change of [{title:" "},{body:"x".repeat(20001)},{folderId:"bad"}])expect(()=>parsePostInput({...post,...change})).toThrow();});
  it("limits folder/comment content and pagination",()=>{expect(parseFolderName(" 폴더 ")).toBe("폴더");expect(()=>parseFolderName("x".repeat(61))).toThrow();expect(()=>parseCommentBody("x".repeat(2001))).toThrow();expect(pageNumber(null)).toBe(1);for(const n of [0,-1,"NaN",1.5])expect(()=>pageNumber(n)).toThrow();});
  it("requires explicit like state instead of retry-unsafe toggles",()=>{expect(parseLikeInput({liked:true})).toBe(true);expect(parseLikeInput({liked:false})).toBe(false);for(const v of [{},{liked:1},{liked:"true"},null])expect(()=>parseLikeInput(v)).toThrow();});
});
describe("bounded HTTP parsing",()=>{
  it("checks actual streamed bytes even without Content-Length",async()=>{const request=new Request("http://localhost/api/community",{method:"POST",body:"123456"});await expect(readBytes(request,5)).rejects.toThrow("PAYLOAD_TOO_LARGE");});
  it("rejects declared oversize before consuming input",async()=>{const request=new Request("http://localhost/api/community",{method:"POST",headers:{"content-length":"600"},body:"123"});await expect(readBytes(request,5)).rejects.toThrow("PAYLOAD_TOO_LARGE");});
  it("accepts a body exactly at the limit",async()=>{expect((await readBytes(new Request("http://localhost",{method:"POST",body:"12345"}),5)).toString()).toBe("12345");});
  it("rejects cross-site mutations",()=>{expect(()=>assertSameOrigin(new Request("http://localhost/api/community",{headers:{origin:"https://other.example"}}))).toThrow("FORBIDDEN");expect(()=>assertSameOrigin(new Request("http://localhost/api/community",{headers:{"sec-fetch-site":"cross-site"}}))).toThrow("FORBIDDEN");});
  it("validates JSON and requires the JSON content type",async()=>{await expect(readJson(new Request("http://localhost",{method:"POST",body:"{}"}))).rejects.toThrow("INVALID_CONTENT_TYPE");await expect(readJson(new Request("http://localhost",{method:"POST",headers:{"content-type":"application/json"},body:"{bad"}))).rejects.toThrow("INVALID_INPUT");});
});
