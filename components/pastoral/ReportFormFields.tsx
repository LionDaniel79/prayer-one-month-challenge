"use client";
import type { ReportForm } from "../../src/features/pastoral/policy";
type Field<T> = { key: keyof T; label: string; max: number; multiline?: boolean };
function FormRows<T extends object>({ title, rows, blank, fields, max, onChange }: { title: string; rows: T[]; blank: T; fields: Field<T>[]; max: number; onChange: (rows: T[]) => void }) {
  return <section className="pastoral-section"><div className="pastoral-toolbar"><h3>{title}</h3><button type="button" onClick={() => onChange([...rows, { ...blank }])} disabled={rows.length >= max}>{title} 행 추가</button></div>
    {rows.map((row, i) => <div className="pastoral-input-row" key={i}><div className="pastoral-row-label"><strong>{i + 1}행</strong><button type="button" onClick={() => onChange(rows.filter((_, index) => index !== i))} aria-label={`${title} ${i + 1}행 제거`}>행 제거</button></div>
      {fields.map(field => <label key={String(field.key)}>{field.label}{field.multiline ? <textarea aria-label={`${title} ${i + 1}행 ${field.label}`} value={String(row[field.key])} rows={3} maxLength={field.max} onChange={e => onChange(rows.map((r, j) => j === i ? { ...r, [field.key]: e.target.value } : r))} /> : <input aria-label={`${title} ${i + 1}행 ${field.label}`} value={String(row[field.key])} maxLength={field.max} onChange={e => onChange(rows.map((r, j) => j === i ? { ...r, [field.key]: e.target.value } : r))} />}</label>)}
    </div>)}
  </section>;
}

export function ReportFormFields({form,onChange}:{form:ReportForm;onChange:(form:ReportForm)=>void}) {
 const updateForm=(patch:Partial<ReportForm>)=>onChange({...form,...patch});
 return <>
        <label className="pastoral-check"><input type="checkbox" checked={form.noMeeting} onChange={e => updateForm({ noMeeting: e.target.checked })} />이번 기간 샘모임 없음</label>
        {form.noMeeting && <label>샘모임을 하지 못한 이유<textarea aria-label="샘모임을 하지 못한 이유" value={form.noMeetingReason} onChange={e => updateForm({ noMeetingReason: e.target.value })} maxLength={2000} rows={3} required /></label>}
        {!form.noMeeting && <FormRows title="샘모임" rows={form.meetings} blank={{ when: "", place: "", attendees: "" }} fields={[{ key: "when", label: "일시", max: 100 }, { key: "place", label: "장소", max: 300 }, { key: "attendees", label: "참석자(가정)", max: 1200, multiline: true }]} max={12} onChange={meetings => updateForm({ meetings })} />}
        <FormRows title="나눔/기도제목" rows={form.sharing} blank={{ member: "", content: "" }} fields={[{ key: "member", label: "샘원", max: 100 }, { key: "content", label: "나눔 / 기도제목 (예배·성경통독은혜·기도제목)", max: 2000, multiline: true }]} max={40} onChange={sharing => updateForm({ sharing })} />
        <FormRows title="샘소식" rows={form.news} blank={{ member: "", content: "" }} fields={[{ key: "member", label: "샘원", max: 100 }, { key: "content", label: "소식 (결혼, 장례, 이사, 입원 등)", max: 2000, multiline: true }]} max={30} onChange={news => updateForm({ news })} />
        <label className="pastoral-section">샘리더 기도제목<textarea aria-label="샘리더 기도제목" rows={5} value={form.leaderPrayer} maxLength={5000} onChange={e => updateForm({ leaderPrayer: e.target.value })} /></label>
        <label className="pastoral-section">기타<textarea aria-label="기타" rows={5} value={form.other ?? ""} maxLength={5000} onChange={e => updateForm({ other: e.target.value })} /></label>
 </>;
}
