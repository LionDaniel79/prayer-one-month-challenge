"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import styles from "./email-notifications.module.css";

type EmailStatus={recipient:string;enabled:boolean;connected:boolean;googleEmail:string|null;verified:boolean;configured:boolean;production:boolean;counts:{pending:number;sent:number;failed:number;unknown:number};lastError:string|null};
const endpoint="/api/admin/email-notifications";
const messages:Record<string,string>={
 EMAIL_NOT_CONFIGURED:"Vercel Production에 Google Client ID·Secret 및 명단 암호화 키 설정이 필요합니다.",
 EMAIL_PRODUCTION_REQUIRED:"이 기능은 설정된 정식 서비스 주소에서만 사용할 수 있습니다.",
 EMAIL_VERIFICATION_REQUIRED:"Gmail 연결 후 확인 메일을 먼저 보내 주세요.",
 EMAIL_TEST_WAIT:"이미 처리 중이거나 방금 보냈습니다. 1분 후 상태를 새로 확인해 주세요.",
 INVALID_EMAIL_RECIPIENT:"이메일 주소 한 개를 정확히 입력해 주세요.",
 GMAIL_ACCOUNT_MISMATCH:"저장한 알림 수신 주소와 같은 Google 계정으로 승인해 주세요.",
 GMAIL_SEND_PERMISSION_REQUIRED:"Gmail API를 켜고 메일 보내기 권한을 승인해 주세요.",
 GMAIL_CONNECT_REQUIRED:"Gmail 계정을 먼저 연결해 주세요.",
 GMAIL_CONSENT_REQUIRED:"메일 발송을 위해 Google 계정의 권한 승인이 필요합니다.",
 GMAIL_RECONNECT_REQUIRED:"Google 승인이 만료되었거나 철회되었습니다. Gmail을 다시 연결해 주세요.",
 GMAIL_REFRESH_UNAVAILABLE:"Google 인증에 일시적인 문제가 있습니다. 대기 알림은 재시도합니다.",
 GMAIL_SEND_REJECTED:"Gmail이 발송을 거절했습니다. Gmail API 활성화와 발송 권한을 확인해 주세요.",
 GMAIL_RATE_LIMITED:"Google 발송 제한으로 대기 중이며 정해진 간격으로 재시도합니다.",
 DELIVERY_UNKNOWN:"전송 결과가 불확실하여 중복 발송을 막기 위해 재발송을 보류했습니다. Gmail을 확인해 주세요.",
 EMAIL_SETTINGS_CHANGED:"다른 관리자가 설정을 변경했습니다. 상태를 새로 확인해 주세요.",
 EMAIL_OAUTH_STATE_INVALID:"연결 요청이 만료되었거나 이미 사용됐습니다. 이 화면에서 다시 연결해 주세요.",
};
function explain(code:string){return messages[code]??"이메일 알림 처리 결과를 확인하지 못했습니다. 상태를 새로 확인해 주세요.";}
async function call(init?:RequestInit){
 const response=await fetch(endpoint,{cache:"no-store",...init});const body=await response.json();
 if(!response.ok)throw new Error(typeof body.code==="string"?body.code:"EMAIL_SERVICE_UNAVAILABLE");
 return body;
}
function NotificationSettings(){
 const [data,setData]=useState<EmailStatus|null>(null),[recipient,setRecipient]=useState(""),[enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 function accept(s:EmailStatus){setData(s);setRecipient(s.recipient);setEnabled(s.enabled);}
 useEffect(()=>{
  const controller=new AbortController();
  void call({signal:controller.signal}).then((s:EmailStatus)=>{
   if(controller.signal.aborted)return;accept(s);
   const result=new URLSearchParams(window.location.search).get("email");
   if(result==="connected")setMessage("Gmail이 연결되었습니다. 확인 메일을 보낸 뒤 알림을 켜 주세요.");
   else if(result)setError(explain(result));
  }).catch(()=>{if(!controller.signal.aborted)setError("알림 설정을 불러오지 못했습니다. 새로고침해 주세요.");});
  return ()=>controller.abort();
 },[]);
 async function refresh(){setBusy(true);setError("");try{accept(await call());}catch(e){setError(explain(e instanceof Error?e.message:""));}finally{setBusy(false);}}
 async function save(event:FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError("");setMessage("");try{
  accept(await call({method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipient,enabled})}));setMessage("저장했습니다. 알림을 켠 이후의 새 접수부터 적용됩니다.");
 }catch(e){setError(explain(e instanceof Error?e.message:""));}finally{setBusy(false);}}
 async function action(actionName:"connect"|"test"|"disconnect"|"dispatch"){
  if(busy)return;
  if(actionName==="disconnect"&&!window.confirm("Gmail 알림 연결을 해제할까요? 대기 알림은 취소됩니다. 캘린더 연결은 유지됩니다."))return;
  setBusy(true);setError("");setMessage("");
  try{
   const result=await call({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:actionName})});
   if(actionName==="connect"){
    const url=new URL(result.url);if(url.protocol!=="https:"||url.hostname!=="accounts.google.com")throw new Error("EMAIL_SERVICE_UNAVAILABLE");
    window.location.assign(url.toString());return;
   }
   accept(result);
   setMessage(actionName==="test"?(result.verified?"Gmail이 확인 메일을 접수했습니다. 받은편지함·스팸함을 확인한 뒤 알림 사용을 켜고 저장해 주세요.":"확인 메일이 아직 완료되지 않았습니다. 아래 상태와 오류 안내를 확인해 주세요."):actionName==="disconnect"?"Gmail 알림 연결을 해제했습니다. 기존 캘린더 연결은 변경하지 않았습니다.":"대기 알림 처리를 요청했습니다.");
  }catch(e){setError(explain(e instanceof Error?e.message:""));}finally{setBusy(false);}
 }
 const changed=data!==null&&recipient.trim().toLowerCase()!==data.recipient;
 return <div className="admin-section">
  <p className="helper-text">목양지·심방신청·기도요청 접수 시 샘과 이름, 심방 일시만 한 줄로 보냅니다. 기도제목·심방 사유·전화번호·첨부파일은 메일에 포함하지 않습니다.</p>
  <Link href="/privacy#email-notifications">이메일 알림 개인정보 이용 안내</Link>
  {!data?<p role="status">알림 설정을 불러오는 중입니다.</p>:<>
   {!data.production&&<p className="helper-text">알림 연결과 발송은 정식 서비스에서만 가능합니다. Preview에서는 발송하지 않습니다.</p>}
   {!data.configured&&<p className="helper-text">{messages.EMAIL_NOT_CONFIGURED}</p>}
   <form className="admin-form" onSubmit={event=>void save(event)}>
    <label>알림 받을 이메일<input type="email" value={recipient} maxLength={254} required disabled={busy||!data.production}
     onChange={event=>{setRecipient(event.target.value);setEnabled(false);setMessage("");}}/></label>
    <p className="helper-text">수신 주소를 저장하고 같은 Gmail 계정으로 연결하세요. 메일함 읽기 권한은 요청하지 않습니다.</p>
    <label className="checkbox-row"><input type="checkbox" checked={enabled} disabled={busy||!data.production||!data.verified||changed} onChange={event=>setEnabled(event.target.checked)}/>접수 이메일 알림 사용</label>
    <button className="primary-button compact-button" type="submit" disabled={busy||!data.production}>알림 설정 저장</button>
   </form>
   <p>연결: {data.connected?(data.googleEmail??"연결됨"):"연결 안 됨"} · 확인 메일: {data.verified?"발송 접수 완료":"확인 필요"} · 자동 알림: {data.enabled?"사용":"중지"}</p>
   <div className="button-row">
    <button type="button" className="secondary-button" disabled={busy||!data.production||!data.configured||!data.recipient||changed} onClick={()=>void action("connect")}>{data.connected?"Gmail 다시 연결":"Gmail 연결"}</button>
    <button type="button" className="secondary-button" disabled={busy||!data.production||!data.connected||changed} onClick={()=>void action("test")}>확인 메일 보내기</button>
    <button type="button" className="text-button" disabled={busy||!data.production||!data.connected} onClick={()=>void action("disconnect")}>Gmail 알림 연결 해제</button>
   </div>
   <p className="helper-text">대기 {data.counts.pending}건 · 발송 접수 {data.counts.sent}건 · 실패 {data.counts.failed}건 · 결과 미확정 {data.counts.unknown}건</p>
   {data.lastError&&<p className="error-text" role="status">{explain(data.lastError)}</p>}
   {data.counts.unknown>0&&<p className="helper-text">결과 미확정 알림은 자동 재발송하지 않습니다. Gmail에서 수신 여부를 확인하세요.</p>}
   <p className="helper-text">알림을 끄거나 수신 주소를 바꾸면 미발송 알림이 취소됩니다. 이미 전송을 시작한 메일은 도착할 수 있습니다. 이 화면의 연결 해제는 Gmail 알림만 중지합니다.</p>
  </>}
  <button type="button" className="text-button" disabled={busy} onClick={()=>void refresh()}>알림 상태 새로 확인</button>
  {error&&<p className="error-text" role="alert">{error}</p>}
  {message&&<p className="success-text" role="status">{message}</p>}
 </div>;
}
export function EmailNotifications(){
 const detail=useRef<HTMLDetailsElement>(null);const [open,setOpen]=useState(false);
 useEffect(()=>{if(window.location.hash==="#email-notifications"&&detail.current)detail.current.open=true;},[]);
 return <details className={`card ${styles.panel}`} id="email-notifications" ref={detail} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>접수 이메일 알림</summary>{open&&<NotificationSettings/>}
 </details>;
}
