"use client";

import { useEffect, useState } from "react";

export function PushSettingsStatus({
  configured,
}: {
  configured: boolean;
}) {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    if (!configured) {
      setHealthy(false);
      return;
    }

    let cancelled = false;
    void fetch("/api/push/public-key", { cache: "no-store" })
      .then((response) => {
        if (!cancelled) setHealthy(response.ok);
      })
      .catch(() => {
        if (!cancelled) setHealthy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configured]);

  return (
    <section className="card admin-setting-card">
      <div>
        <h2>새 공지 Push</h2>
        <p className="helper-text">
          사용자가 알림을 허용한 기기에 새 공지 알림을 보냅니다.
        </p>
      </div>
      <div className="setting-health">
        <span className={configured && healthy !== false ? "status-pill is-success" : "status-pill"}>
          {configured ? "서버 설정됨" : "서버 설정 필요"}
        </span>
        {configured && (
          <span className="helper-text">
            {healthy === null
              ? "공개키 상태 확인 중"
              : healthy
                ? "공개키 엔드포인트 정상"
                : "공개키 엔드포인트 확인 필요"}
          </span>
        )}
      </div>
    </section>
  );
}
