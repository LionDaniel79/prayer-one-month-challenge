import type { ProfileData } from "../../src/lib/types";

export function ProfileForm({ initial }: { initial: ProfileData }) {
  return (
    <section className="card">
      <dl className="profile-summary">
        <div><dt>이름</dt><dd>{initial.displayName}</dd></div>
        <div><dt>직분</dt><dd>{initial.position ?? "미지정"}</dd></div>
        <div><dt>샘</dt><dd>{initial.samLabel ?? "미지정"}</dd></div>
      </dl>
      <p className="helper-text">
        명단 정보 수정은 관리자에게 요청해 주세요.
      </p>
    </section>
  );
}
