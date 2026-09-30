"use client";
import { useRef, useState } from "react";
import { CHUNK_LIMIT, FILE_LIMIT, parseReportEdit, type Method, type ReportEdit } from "../../src/features/pastoral/policy";
import { api, emptyForm, jsonBody, message, metadata, type ReportView } from "./client";
import { ReportFormFields } from "./ReportFormFields";
export function ReportEditor({report,admin,onSaved,onCancel}:{report:ReportView;admin:boolean;onSaved:()=>void;onCancel:()=>void}) {
  const [method,setMethod]=useState<Method>(report.method);const [writtenDate,setWrittenDate]=useState(report.writtenDate);
  const [form,setForm]=useState(()=>({...emptyForm(),...(report.form??{})}));
  const [keepSlots,setKeepSlots]=useState(()=>report.files.map((_,i)=>i));const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);const [locked,setLocked]=useState(false);const [error,setError]=useState("");const [progress,setProgress]=useState("");
  const pending=useRef<{input:ReportEdit;files:File[];stage:"upload"|"publish"}|null>(null);
  const base=`/api/${admin?"admin/":""}pastoral/reports/${report.id}/edits`;
  function addFiles(selected:FileList|null) {
    const next=[...files,...Array.from(selected??[])];
    if(next.length+keepSlots.length>2||next.some(f=>!f.size||f.size>FILE_LIMIT)){setError("남겨 둔 파일과 새 파일을 합해 최대 2개, 파일당 6MB 이하입니다.");return;}
    setFiles(next);setError("");
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();if(busy)return;setBusy(true);setError("");
    try {
      if(!pending.current){
        const input=parseReportEdit({id:crypto.randomUUID(),expectedVersion:report.version,method,writtenDate,form:method==='form'?form:null,keepSlots:method==='form'?[]:keepSlots,files:await metadata(method==='form'?[]:files)});
        pending.current={input,files:method==='form'?[]:[...files],stage:'upload'};setLocked(true);
      }
      const draft=pending.current;
      const result=await api<{applied:boolean}>(base,jsonBody('POST',draft.input));
      if(!result.applied){
        if(draft.stage==='upload'){
          const total=draft.files.reduce((n,f)=>n+Math.ceil(f.size/CHUNK_LIMIT),0);let sent=0;
          for(let slot=0;slot<draft.files.length;slot++)for(let start=0,i=0;start<draft.files[slot].size;start+=CHUNK_LIMIT,i++){
            setProgress(`교체 파일 전송 ${Math.round(sent/total*100)}%`);
            await api(`${base}/${draft.input.id}/files/${slot}/chunks/${i}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:await draft.files[slot].slice(start,start+CHUNK_LIMIT).arrayBuffer()});sent++;
          }
          draft.stage='publish';
        }
        setProgress('수정 내용을 저장하고 있습니다.');await api(`${base}/${draft.input.id}/publish`,jsonBody('POST'));
      }
      pending.current=null;setLocked(false);window.dispatchEvent(new Event('pastoral:changed'));onSaved();
    }catch(e){setError(message(e));}finally{setBusy(false);setProgress("");}
  }
  async function cancel(close:boolean) {
    if(busy)return;setBusy(true);setError("");
    try {
      if(pending.current)await api(`${base}/${pending.current.input.id}`,jsonBody('DELETE'));
      pending.current=null;setLocked(false);if(close)onCancel();
    }catch(e){
      if(e instanceof Error&&e.message==='EDIT_APPLIED'){pending.current=null;onSaved();}
      else if(e instanceof Error&&e.message==='EDIT_NOT_FOUND'){pending.current=null;setLocked(false);if(close)onCancel();}
      else setError(message(e));
    }finally{setBusy(false);}
  }
  return <form className="pastoral-entry card" aria-label="목양지 수정" onSubmit={save}><h2>목양지 수정</h2><p>{report.periodLabel} · {report.samName}샘 · 원래 제출자 {report.submittedBy}</p>
    <p className="helper-text">수정 저장이 성공하기 전에는 기존 목양지와 첨부가 유지됩니다. 제출 월과 원래 제출자는 바뀌지 않습니다.</p>
    <fieldset disabled={busy||locked}><legend>수정할 내용</legend><label>작성일<input type="date" value={writtenDate} onChange={e=>setWrittenDate(e.target.value)}/></label>
      <div className="pastoral-methods">{([['photo','사진'],['file','파일'],['form','직접 입력']] as const).map(([value,label])=><label key={value}><input type="radio" name="pastoral-edit-method" checked={method===value} onChange={()=>{setMethod(value);if(value==='form'){setKeepSlots([]);setFiles([]);}setError("");}}/>{label}</label>)}</div>
      {method==='form'?<ReportFormFields form={form} onChange={setForm}/>:<div className="pastoral-files">
        {report.files.map((f,slot)=><label className="pastoral-check" key={slot}><input type="checkbox" checked={keepSlots.includes(slot)} onChange={e=>{setKeepSlots(v=>e.target.checked?[...v,slot].sort():v.filter(n=>n!==slot));}}/>{f.name} 유지</label>)}
        <label>새 첨부파일 추가<input type="file" multiple accept={method==='photo'?'image/*':'.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,image/*'} onChange={e=>{addFiles(e.target.files);e.target.value='';}}/></label>
        <p className="helper-text">기존 파일의 ‘유지’ 체크를 해제하면 저장 시 제거됩니다. 남겨 둔 파일과 새 파일을 합해 최대 2개, 파일당 6MB입니다.</p>
        {files.map((f,i)=><div className="pastoral-file-row" key={i}><span>{f.name}</span><button type="button" onClick={()=>setFiles(v=>v.filter((_,j)=>i!==j))}>새 파일 제거</button></div>)}
      </div>}
    </fieldset>
    {error&&<p className="error-text" role="alert">{error}</p>}{progress&&<p role="status">{progress}</p>}
    <div className="pastoral-toolbar"><button className="primary-button" disabled={busy} type="submit">{busy?'저장 중…':locked?'같은 수정으로 다시 시도':'수정 저장'}</button>{locked&&<button disabled={busy} type="button" onClick={()=>void cancel(false)}>입력 내용 다시 수정</button>}<button disabled={busy} type="button" onClick={()=>void cancel(true)}>수정 취소</button></div>
  </form>;
}
