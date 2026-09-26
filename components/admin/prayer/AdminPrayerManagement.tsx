"use client";

import { useMemo, useState } from "react";
import type { AdminDashboardData } from "../../../src/features/admin/service";
import { defaultEndDate } from "../../../src/features/challenge/date";

function percent(value: number) {
  return Math.round(value * 100) + "%";
}

async function jsonRequest(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code ?? "REQUEST_FAILED");
  return body;
}

export function AdminPrayerManagement({ initial }: { initial: AdminDashboardData }) {
  const [showChallenge, setShowChallenge] = useState(false);
  const [error, setError] = useState("");
  const [participantQuery, setParticipantQuery] = useState("");
  const [samFilter, setSamFilter] = useState("");
  const [challengeStart, setChallengeStart] = useState(initial.challenge?.startDate ?? "");
  const [challengeEnd, setChallengeEnd] = useState(initial.challenge?.endDate ?? "");

  const filteredMembers = useMemo(() => {
    const needle = participantQuery.trim().toLocaleLowerCase("ko-KR");
    return initial.members.filter((member) => {
      const matchesText =
        !needle ||
        member.name.toLocaleLowerCase("ko-KR").includes(needle) ||
        (member.position ?? "").toLocaleLowerCase("ko-KR").includes(needle);
      const matchesSam = !samFilter || (member.samLabel ?? "미지정") === samFilter;
      return matchesText && matchesSam;
    });
  }, [initial.members, participantQuery, samFilter]);

  function changeStart(value: string) {
    setChallengeStart(value);
    setChallengeEnd(value ? defaultEndDate(value) : "");
  }

  async function submitChallenge(formData: FormData) {
    setError("");
    try {
      await jsonRequest("/api/admin/challenge", {
        method: "POST",
        body: JSON.stringify({
          id: initial.challenge?.id,
          title: String(formData.get("title") ?? ""),
          startDate: challengeStart,
          endDate: challengeEnd || undefined,
          isActive: formData.get("isActive") === "on",
        }),
      });
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "도전 설정을 저장하지 못했습니다.");
    }
  }

  return (
    <div className="admin-feature-page">
      <div className="section-heading">
        <section className="admin-page-heading">
          <p className="eyebrow">기도운동</p>
          <h1>기도운동 관리</h1>
          <p>
            {initial.challenge
              ? initial.challenge.startDate + " ~ " + initial.challenge.endDate
              : "활성 도전 없음"}
          </p>
        </section>
        <button className="primary-button compact-button" type="button" onClick={() => setShowChallenge(true)}>
          도전 설정
        </button>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      <section className="admin-kpis" aria-label="기도운동 현황">
        <article className="card"><span>전체 참여자</span><strong>{initial.totals.members}명</strong></article>
        <article className="card"><span>오늘 완료</span><strong>{initial.totals.todayCompleted}명 · {percent(initial.totals.todayRate)}</strong></article>
        <article className="card"><span>평균 달성률</span><strong>{percent(initial.totals.averageRate)}</strong></article>
      </section>

      <section className="card admin-section">
        <h2>달성률 구간</h2>
        <div className="bucket-grid">
          <div><strong>{initial.buckets.perfect}</strong><span>100%</span></div>
          <div><strong>{initial.buckets.high}</strong><span>80~99%</span></div>
          <div><strong>{initial.buckets.medium}</strong><span>60~79%</span></div>
          <div><strong>{initial.buckets.low}</strong><span>60% 미만</span></div>
        </div>
      </section>

      <section className="card admin-section">
        <h2>샘별 통계</h2>
        <div className="admin-table">
          <div className="admin-row admin-row-head">
            <span>샘</span><span>인원</span><span>평균</span><span>오늘</span>
          </div>
          {initial.sams.map((sam) => (
            <div className="admin-row" key={sam.samLabel}>
              <span><strong>{sam.samLabel}</strong></span>
              <span>{sam.members}명</span>
              <span>{percent(sam.averageRate)}</span>
              <span>{sam.todayCompleted}명 · {percent(sam.todayRate)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <h2>참여자 명단</h2>
          <div className="admin-filters">
            <input
              value={participantQuery}
              onChange={(event) => setParticipantQuery(event.target.value)}
              placeholder="이름 또는 직분 검색"
              aria-label="참여자 검색"
            />
            <select value={samFilter} onChange={(event) => setSamFilter(event.target.value)} aria-label="샘 필터">
              <option value="">전체 샘</option>
              {initial.sams.map((sam) => (
                <option key={sam.samLabel} value={sam.samLabel}>{sam.samLabel}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-table participant-table">
          <div className="admin-row admin-row-head participant-row">
            <span>이름</span><span>직분</span><span>전화번호</span><span>샘</span>
            <span>순위</span><span>달성률</span><span>오늘</span>
          </div>
          {filteredMembers.map((member) => (
            <div className="admin-row participant-row" key={member.userId}>
              <span><strong>{member.name}</strong>{member.role === "admin" && <small>관리자</small>}</span>
              <span>{member.position ?? "미지정"}</span>
              <span>{member.phone ?? "미지정"}</span>
              <span>{member.samLabel ?? "미지정"}</span>
              <span>{member.rank}위</span>
              <span>{member.completed}/{member.eligible} · {percent(member.rate)}</span>
              <span>{member.completedToday ? "완료" : "미완료"}</span>
            </div>
          ))}
        </div>
      </section>

      {showChallenge && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowChallenge(false)}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-label="도전 설정" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowChallenge(false)} aria-label="닫기">×</button>
            <form action={submitChallenge} className="admin-form">
              <h2>도전 설정</h2>
              <label>제목<input name="title" defaultValue={initial.challenge?.title ?? "기도운동 1달 도전"} required /></label>
              <label>시작일<input name="startDate" type="date" value={challengeStart} onChange={(event) => changeStart(event.target.value)} required /></label>
              <label>종료일<input name="endDate" type="date" value={challengeEnd} onChange={(event) => setChallengeEnd(event.target.value)} required /></label>
              <p className="helper-text">시작일을 바꾸면 1개월 기준 종료일이 자동 계산됩니다.</p>
              <label className="checkbox-row"><input name="isActive" type="checkbox" defaultChecked={initial.challenge?.isActive ?? true} /> 활성화</label>
              <button className="primary-button" type="submit">저장</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
