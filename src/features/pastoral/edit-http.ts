import { beginReportEdit, cancelReportEdit, deleteSubmittedReport, publishReportEdit, putEditChunk } from "./edits";
import { boundedBytes, boundedJson, json } from "./http";
import { CHUNK_LIMIT, int, object, ReportError, type Actor } from "./policy";
/** Caller must authenticate and perform same-origin check before invoking this handler. */
export async function revisionResponse(request: Request, path: string[], actor: Actor, admin: boolean) {
  if(path[0]!=="reports")return null;
  const id=path[1];
  if(request.method==='DELETE'&&path.length===3&&path[2]==='submission') {
    const input=object(await boundedJson(request));
    await deleteSubmittedReport(actor,id,int(input.expectedVersion,0,2147483646),admin);return json({status:'ok'});
  }
  if(path[2]!=="edits")return null;
  if(request.method==='POST'&&path.length===3)return json(await beginReportEdit(actor,id,await boundedJson(request),admin),201);
  if(request.method==='POST'&&path.length===5&&path[4]==='publish')return json(await publishReportEdit(actor,id,path[3],admin));
  if(request.method==='DELETE'&&path.length===4) {await cancelReportEdit(actor,id,path[3],admin);return json({status:'ok'});}
  if(request.method==='PUT'&&path.length===8&&path[4]==='files'&&path[6]==='chunks') {
    if(request.headers.get('content-type')!=='application/octet-stream')throw new ReportError('INVALID_CONTENT_TYPE',415);
    await putEditChunk(actor,id,path[3],Number(path[5]),Number(path[7]),await boundedBytes(request,CHUNK_LIMIT),admin);return json({status:'ok'});
  }
  return null;
}
