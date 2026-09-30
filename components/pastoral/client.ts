import { fetchJson } from "../../src/lib/fetch-json";
import type { Attachment, ReportAccess, ReportForm, ReportRequest, Submission } from "../../src/features/pastoral/policy";
export { fetchJson as api };
export type Status = ReportAccess & { today: string; count: number; requests: ReportRequest[]; completed: { requestId: string; samId: string }[] };
export type Summary = { id: string; samName: string; leaderName: string; submittedBy: string; method: string; submittedAt: string; periodLabel: string };
export type ReportView = Submission & Omit<Summary, "submittedAt"> & { submittedAt: string | null; version: number; isOwner: boolean };
export const emptyForm = (): ReportForm => ({ noMeeting: false, noMeetingReason: "", meetings: [{ when: "", place: "", attendees: "" }], sharing: [{ member: "", content: "" }], news: [{ member: "", content: "" }], leaderPrayer: "", other: "" });
export const jsonBody = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
export const methodLabel = (method: string) => ({ photo: "사진", file: "파일", form: "직접 입력" })[method] ?? method;
export function message(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return ({
    LEADER_SELECTION_REQUIRED:"동명이인이 있습니다. 소속을 확인해 한 분을 선택해 주세요.", LEADER_SELECTION_INVALID:"선택한 성도의 이름·소속을 다시 확인해 주세요.",
    REPORT_CHANGED: "다른 수정이 먼저 저장되었습니다. 입력 내용을 보관하고 목양지를 다시 열어 주세요.", EDIT_APPLIED: "이미 수정 저장되었습니다. 최신 목양지를 확인해 주세요.", EDIT_NOT_FOUND: "수정 초안을 찾을 수 없습니다. 목양지를 다시 열어 주세요.", REPORT_NOT_FINALIZED: "제출 완료된 목양지만 수정·삭제할 수 있습니다.",
    INVALID_INPUT: "입력 내용과 날짜를 확인해 주세요.", INVALID_DATE: "올바른 날짜를 선택해 주세요.",
    MONTH_CLOSED: "선택한 달 안에서만 제출할 수 있습니다. 현재 월을 확인해 주세요.", INVALID_VILLAGE_LABEL: "마을장은 1마을장과 같은 형식으로 입력해 주세요.", NO_MEETING_REASON_REQUIRED: "샘모임을 하지 못한 이유를 입력해 주세요.", INVALID_FILE_COUNT: "사진이나 파일은 1~2개, 직접 입력은 파일 없이 제출해 주세요.",
    UNSUPPORTED_FILE: "지원하지 않는 파일입니다. PDF·한글·Word·Excel·텍스트 또는 사진을 선택해 주세요.",
    PHOTO_REQUIRED: "사진 제출에는 사진 파일을 선택해 주세요.", UNSUPPORTED_IMAGE: "사진을 확인할 수 없습니다. JPG·PNG로 변환하거나 파일 제출을 이용해 주세요.",
 REPORT_TOO_LONG: "입력한 내용이 너무 깁니다. 내용을 줄여 주세요.",
    TOO_MANY_ROWS: "추가할 수 있는 행 수를 초과했습니다.", FORBIDDEN: "목양지 권한이 없거나 담당 샘이 변경되었습니다. 관리자에게 확인해 주세요.",
    UNAUTHORIZED: "다시 로그인해 주세요.", SCHEDULE_CHANGED: "다른 관리자가 일정을 변경했습니다. 다시 불러온 뒤 선택해 주세요.",
    REQUEST_NOT_OPEN: "아직 제출 시작일이 아닙니다.", REQUEST_CLOSED: "제출 요청이 해제되었습니다. 목록을 새로고침해 주세요.",
    ALREADY_SUBMITTED: "이 샘의 목양지는 이미 제출되었습니다. 목록을 새로고침해 주세요.", REPORT_FINALIZED: "이미 제출 완료된 목양지입니다. 제출 내역에서 확인해 주세요.",
    REPORT_NOT_FOUND: "목양지를 찾을 수 없거나 열람 권한이 없습니다.", UPLOAD_INCOMPLETE: "파일 전송이 끝나지 않았습니다. 같은 내용으로 다시 시도해 주세요.",
    FILE_INTEGRITY_FAILED: "파일 전송 내용을 확인할 수 없습니다. 다시 시도해 주세요.", DRAFT_LIMIT: "작성 중인 목양지가 많습니다. 중단한 초안을 취소하거나 24시간 후 다시 시도해 주세요.",
    DRAFT_EXPIRED: "작성 시간이 만료되었습니다. 내용을 보관한 뒤 새로 작성해 주세요.", ID_CONFLICT: "작성 정보가 변경되었습니다. 작성 취소 후 다시 입력해 주세요.",
    PASTORAL_UNAVAILABLE: "목양지 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
  } as Record<string, string>)[code] ?? "연결을 확인하고 다시 시도해 주세요. 입력 내용은 이 화면에 유지됩니다.";
}
export function localDateTime(value: string) { return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }); }
export async function metadata(files: File[]): Promise<Attachment[]> {
  const output: Attachment[] = [];
  for (const file of files) {
    const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    output.push({ name: file.name, size: file.size, sha256: [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("") });
  }
  return output;
}
