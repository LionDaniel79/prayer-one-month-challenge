"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminDashboardData } from "../../src/features/admin/service";
import { defaultEndDate } from "../../src/features/challenge/date";

type Modal = "challenge" | "sam" | "user" | null;

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code ?? "REQUEST_FAILED");
  return body;
}

export function AdminDashboard({ initial }: { initial: AdminDashboardData }) {
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [samFilter, setSamFilter] = useState("");
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(initial.members[0]?.userId ?? "");
  const [selectedSamId, setSelectedSamId] = useState("");
  const [challengeStart, setChallengeStart] = useState(initial.challenge?.startDate ?? "");
  const [challengeEnd, setChallengeEnd] = useState(initial.challenge?.endDate ?? "");

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    return initial.members.filter((member) => {
      const matchesName = !needle || member.name.toLocaleLowerCase("ko-KR").includes(needle);
      const matchesSam = !samFilter || member.samId === samFilter;
      return matchesName && matchesSam;
    });
  }, [initial.members, query, samFilter]);

  const selectedUser = initial.members.find((member) => member.userId === selectedUserId);
  const selectedSam = initial.sams.find((sam) => sam.samId === selectedSamId);

  function openNewSam() {
    setSelectedSamId("");
    setModal("sam");
  }

  function openExistingSam(samId: string) {
    setSelectedSamId(samId);
    setModal("sam");
  }

  function changeChallengeStart(value: string) {
    setChallengeStart(value);
    if (value) setChallengeEnd(defaultEndDate(value));
    else setChallengeEnd("");
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
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
    }
  }

  async function submitSam(formData: FormData) {
    setError("");
    try {
      await jsonRequest("/api/admin/sams", {
        method: "POST",
        body: JSON.stringify({
          id: selectedSam?.samId,
          name: String(formData.get("name") ?? ""),
          leaderName: String(formData.get("leaderName") ?? ""),
          isActive: formData.get("isActive") === "on",
        }),
      });
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
    }
  }

  async function submitUser(formData: FormData) {
    if (!selectedUser) return;
    setError("");
    try {
      await jsonRequest("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: selectedUser.userId,
          samId: String(formData.get("samId") ?? "") || null,
          role: String(formData.get("role") ?? "member"),
          isActive: formData.get("isActive") === "on",
        }),
      });
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
    }
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">관리자</p>
          <h1>기도운동 진행 현황</h1>
          <p>{initial.challenge ? `${initial.challenge.startDate} ~ ${initial.challenge.endDate}` : "활성 도전 없음"}</p>
        </div>
        <div className="header-actions">
          <Link href="/">사용자 화면</Link>
          <button className="text-button" type="button" onClick={() => setModal("challenge")}>도전 설정</button>
          <button className="text-button" type="button" onClick={openNewSam}>샘 추가</button>
          <button className="text-button" type="button" onClick={() => setModal("user")}>사용자 관리</button>
        </div>
      </header>

      {error && <p className="error-text" role="alert">{error}</p>}

      <section className="admin-kpis" aria-label="전체 현황">
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
        <div className="admin-table" role="table">
          <div className="admin-row admin-row-head" role="row">
            <span>샘</span><span>인원</span><span>평균</span><span>오늘</span>
          </div>
          {initial.sams.map((sam) => (
            <div className="admin-row" role="row" key={sam.samId}>
              <span>
                <strong>{sam.name}</strong>
                <small>{sam.leaderName}{sam.isActive ? "" : " · 비활성"}</small>
                <button className="text-button sam-edit-button" type="button" onClick={() => openExistingSam(sam.samId)}>
                  {sam.name} 수정
                </button>
              </span>
              <span>{sam.members}명</span>
              <span>{percent(sam.averageRate)}</span>
              <span>{sam.todayCompleted}명 · {percent(sam.todayRate)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <h2>개인 현황</h2>
          <div className="admin-filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 검색" aria-label="이름 검색" />
            <select value={samFilter} onChange={(event) => setSamFilter(event.target.value)} aria-label="샘 필터">
              <option value="">전체 샘</option>
              {initial.sams.map((sam) => <option key={sam.samId} value={sam.samId}>{sam.name}</option>)}
            </select>
          </div>
        </div>
        <div className="admin-table member-table" role="table">
          <div className="admin-row admin-row-head" role="row">
            <span>순위 / 이름</span><span>샘</span><span>달성률</span><span>오늘</span>
          </div>
          {filteredMembers.map((member) => (
            <div className="admin-row" role="row" key={member.userId}>
              <span><strong>{member.rank}위 · {member.name}</strong><small>{member.role === "admin" ? "관리자" : "회원"}</small></span>
              <span>{member.samName ?? "미지정"}</span>
              <span>{member.completed}/{member.eligible} · {percent(member.rate)}</span>
              <span>{member.completedToday ? "완료" : "미완료"}</span>
            </div>
          ))}
        </div>
      </section>

      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-label="관리 설정" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="닫기">×</button>

            {modal === "challenge" && (
              <form action={submitChallenge} className="admin-form">
                <h2>도전 설정</h2>
                <label>제목<input name="title" defaultValue={initial.challenge?.title ?? "기도운동 1달 도전"} required /></label>
                <label>시작일<input name="startDate" type="date" value={challengeStart} onChange={(event) => changeChallengeStart(event.target.value)} required /></label>
                <label>종료일<input name="endDate" type="date" value={challengeEnd} onChange={(event) => setChallengeEnd(event.target.value)} required /></label>
                <p className="helper-text">시작일을 바꾸면 1개월 기준 종료일이 자동 계산되며, 필요하면 종료일을 직접 수정할 수 있습니다.</p>
                <label className="checkbox-row"><input name="isActive" type="checkbox" defaultChecked={initial.challenge?.isActive ?? true} /> 활성화</label>
                <button className="primary-button" type="submit">저장</button>
              </form>
            )}

            {modal === "sam" && (
              <form action={submitSam} className="admin-form" key={selectedSam?.samId ?? "new"}>
                <h2>{selectedSam ? "샘 수정" : "샘 추가"}</h2>
                <label>샘 이름<input name="name" defaultValue={selectedSam?.name ?? ""} required /></label>
                <label>샘리더 이름<input name="leaderName" defaultValue={selectedSam?.leaderName ?? ""} required /></label>
                <label className="checkbox-row"><input name="isActive" type="checkbox" defaultChecked={selectedSam?.isActive ?? true} /> 활성 샘</label>
                <button className="primary-button" type="submit">{selectedSam ? "저장" : "추가"}</button>
              </form>
            )}

            {modal === "user" && (
              <form action={submitUser} className="admin-form">
                <h2>사용자 관리</h2>
                <label>사용자
                  <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                    {initial.members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
                  </select>
                </label>
                <label>샘
                  <select name="samId" key={selectedUser?.userId} defaultValue={selectedUser?.samId ?? ""}>
                    <option value="">미지정</option>
                    {initial.sams.filter((sam) => sam.isActive).map((sam) => <option key={sam.samId} value={sam.samId}>{sam.name}</option>)}
                  </select>
                </label>
                <label>권한
                  <select name="role" key={`role-${selectedUser?.userId}`} defaultValue={selectedUser?.role ?? "member"}>
                    <option value="member">회원</option>
                    <option value="admin">관리자</option>
                  </select>
                </label>
                <label className="checkbox-row"><input name="isActive" type="checkbox" key={`active-${selectedUser?.userId}`} defaultChecked={selectedUser?.isActive ?? true} /> 활성 사용자</label>
                <button className="primary-button" type="submit">저장</button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
