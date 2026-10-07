"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "../../../src/lib/fetch-json";
import type { PrayerMenuSetting } from "../../../src/features/prayer-menu/service";

const endpoint = "/api/admin/prayer/menu-settings";

export function PrayerMenuSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetchJson<PrayerMenuSetting>(endpoint, { cache: "no-store", signal: controller.signal })
      .then((setting) => {
        if (typeof setting.enabled !== "boolean") throw new Error("INVALID_SETTING");
        if (!controller.signal.aborted) setEnabled(setting.enabled);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("현재 설정을 불러오지 못했습니다. 다시 불러와 주세요.");
      });
    return () => controller.abort();
  }, [attempt]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enabled === null || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const setting = await fetchJson<PrayerMenuSetting>(endpoint, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }),
      });
      if (typeof setting.enabled !== "boolean") throw new Error("INVALID_SETTING");
      setEnabled(setting.enabled);
      window.dispatchEvent(new CustomEvent("prayer-menu:changed", { detail: setting }));
      setMessage(setting.enabled
        ? "저장했습니다. 모든 사용자에게 기도운동 탭이 표시됩니다."
        : "저장했습니다. 모든 사용자의 메뉴에서 기도운동 탭이 숨겨집니다.");
    } catch {
      setError("저장 결과를 확인하지 못했습니다. 연결을 확인한 뒤 다시 저장해 주세요.");
    } finally { setSaving(false); }
  }

  return (
    <section className="card admin-section" aria-labelledby="prayer-menu-settings-title">
      <h2 id="prayer-menu-settings-title">기도운동 탭 표시 설정</h2>
      <p className="helper-text">모든 사용자에게 공통으로 적용됩니다. 비활성화해도 기존 기도 기록과 도전 설정은 유지됩니다.</p>
      {enabled === null ? (
        <>
          {!error && <p role="status">설정을 불러오는 중입니다.</p>}
          {error && <button type="button" className="text-button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>다시 불러오기</button>}
        </>
      ) : (
        <form className="admin-form" onSubmit={(event) => void save(event)}>
          <label className="checkbox-row">
            <input type="checkbox" name="prayerMenuEnabled" checked={enabled} disabled={saving}
              onChange={(event) => { setEnabled(event.target.checked); setMessage(""); setError(""); }} />
            기도운동 탭 활성화
          </label>
          <p className="helper-text">체크 후 저장하면 메뉴에 표시되고, 체크를 해제한 후 저장하면 메뉴에서 사라집니다.</p>
          <button className="primary-button compact-button" type="submit" disabled={saving}>{saving ? "저장 중..." : "저장"}</button>
        </form>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
      {message && <p className="success-text" role="status">{message}</p>}
    </section>
  );
}
