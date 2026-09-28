import { describe, expect, it } from "vitest";
import { assertAuthor, isPhotoName, parseEditInput, parseFolderOrder } from "../../src/features/community/refinement-policy";
const id="00000000-0000-4000-8000-000000000001";
const input={id,baseVersion:0,title:" title ",body:" body ",keepSlots:[0],files:[]};
describe("community refinement policy",()=>{
  it("normalizes an edit without broadening administrator ownership",()=>{expect(parseEditInput(input).title).toBe("title");expect(()=>assertAuthor({id:"other",role:"admin"},id)).toThrow("FORBIDDEN");expect(()=>assertAuthor({id,role:"admin"},id)).not.toThrow();});
  it("counts retained and new attachments together",()=>{expect(()=>parseEditInput({...input,keepSlots:[0,1],files:[{name:"third.txt",size:1,sha256:"0".repeat(64)}]})).toThrow("TOO_MANY_FILES");});
  it("rejects duplicate and invalid retained slots",()=>{for(const keepSlots of [[0,0],[2],[-1],["0"]])expect(()=>parseEditInput({...input,keepSlots})).toThrow();});
  it("requires a safe optimistic version",()=>{for(const baseVersion of [-1,1.2,"0",null,Number.MAX_SAFE_INTEGER+1])expect(()=>parseEditInput({...input,baseVersion})).toThrow();});
  it("keeps file size, count and extension checks for edits",()=>{expect(()=>parseEditInput({...input,files:[{name:"large.png",size:6291457,sha256:"0".repeat(64)}]})).toThrow("FILE_TOO_LARGE");expect(()=>parseEditInput({...input,files:[{name:"x.svg",size:1,sha256:"0".repeat(64)}]})).toThrow("UNSUPPORTED_FILE");});
  it("requires a complete unique folder permutation",()=>{expect(parseFolderOrder({ids:[id],expectedIds:[id]}).ids).toEqual([id]);expect(()=>parseFolderOrder({ids:[id,id],expectedIds:[id]})).toThrow();expect(()=>parseFolderOrder({ids:[],expectedIds:[]})).toThrow();});
  it("recognizes only photo file names for preview candidates",()=>{for(const name of ["a.JPG","b.png","c.webp","d.avif","e.gif","f.heic"])expect(isPhotoName(name)).toBe(true);for(const name of ["a.pdf","b.svg","c.png.exe","d.html"])expect(isPhotoName(name)).toBe(false);});
});
