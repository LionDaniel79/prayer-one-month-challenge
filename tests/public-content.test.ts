import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AboutPage, { metadata as aboutMetadata } from "../app/(public)/about/page";
import PrivacyPage, { metadata as privacyMetadata } from "../app/(public)/privacy/page";
import { GOOGLE_CALENDAR_SCOPES } from "../src/features/google-calendar/oauth";

const about = () => renderToStaticMarkup(createElement(AboutPage));
const privacy = () => renderToStaticMarkup(createElement(PrivacyPage));

describe("public information content", () => {
  it("describes the real features and links the policy and app entry", () => {
    const html = about();
    for (const feature of ["공지", "기도운동", "심방신청", "기도요청", "커뮤니티", "목양지"]) expect(html).toContain(feature);
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/login"');
    expect(html).toContain("일반 회원의 Google 계정 연결은 필요하지 않습니다.");
    expect(aboutMetadata.alternates?.canonical).toBe("https://prayer-one-month-challenge.vercel.app/about");
  });
  it("documents the exact Google scopes and limits instead of promising no third parties", () => {
    const html = privacy();
    for (const scope of GOOGLE_CALENDAR_SCOPES) expect(html).toContain(scope.split("/auth/")[1]);
    for (const text of ["갱신 토큰", "이벤트 ID", "Supabase", "Vercel", "Google", "Limited Use", "범용 AI 모델", "공유 설정"]) expect(html).toContain(text);
    expect(html).toContain("기존 일정의 제목·설명·참석자 목록은 이 조회에서 요청하지 않으며");
    expect(html).toContain("심방 사유와 별도의 기도요청 내용은 심방 일정 설명에 넣지 않습니다");
    expect(html).toContain("gmail.send");
    expect(html).toContain("기존 메일 본문·목록을 읽거나 수정하는 권한은 요청하지 않습니다");
  });
  it("explains deletion limits and gives a usable revocation and contact path", () => {
    const html = privacy();
    expect(html).toContain("연결 해제만으로 자동 삭제되지 않습니다");
    expect(html).toContain("자동 삭제 기한은 설정되어 있지 않습니다");
    expect(html).toContain('href="https://myaccount.google.com/connections"');
    expect(html).toContain('href="mailto:ditto0310@gmail.com"');
    expect(html).toContain("180일");
    expect(html).not.toContain("TODO");
    expect(privacyMetadata.alternates?.canonical).toBe("https://prayer-one-month-challenge.vercel.app/privacy");
  });
  it("has working section destinations for every policy contents link including Gmail", () => {
    const html = privacy();
    const links = [...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
    expect(links).toHaveLength(10);
    expect(links).toContain("email-notifications");
    expect(new Set(links).size).toBe(links.length);
    for (const id of links) expect(html).toContain(`id="${id}"`);
    expect((html.match(/<h1[ >]/g) ?? [])).toHaveLength(1);
  });
});
