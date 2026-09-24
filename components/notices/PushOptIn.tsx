"use client";

import { useState } from "react";
import { decodeApplicationServerKey } from "../../src/features/push/browser-key";

type PushState =
  | "idle"
  | "subscribing"
  | "subscribed"
  | "denied"
  | "unsupported"
  | "unavailable"
  | "error";

export function PushOptIn() {
  const [state, setState] = useState<PushState>("idle");

  async function enablePush() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }

    setState("subscribing");

    try {
      const keyResponse = await fetch("/api/push/public-key", {
        cache: "no-store",
      });
      if (!keyResponse.ok) {
        setState("unavailable");
        return;
      }
      const keyBody = await keyResponse.json();
      const publicKey = String(keyBody.publicKey ?? "");
      if (!publicKey) {
        setState("unavailable");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(publicKey),
        }));

      const json = subscription.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!p256dh || !auth) throw new Error("INVALID_PUSH_KEYS");

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: { p256dh, auth },
        }),
      });
      if (!response.ok) throw new Error("PUSH_SUBSCRIBE_FAILED");

      setState("subscribed");
    } catch {
      setState("error");
    }
  }

  if (state === "subscribed") {
    return (
      <p className="push-status success-text" role="status">
        새 공지 휴대폰 알림을 받도록 설정했습니다.
      </p>
    );
  }

  return (
    <div className="push-opt-in">
      <div>
        <strong>새 공지 알림</strong>
        <p className="helper-text">
          지원되는 휴대폰이나 브라우저에서는 새 공지가 올라오면 알림을 받을 수 있습니다.
        </p>
        {state === "denied" && (
          <p className="helper-text" role="status">
            알림 권한이 허용되지 않았습니다. 앱 안의 새 공지 배지는 계속 표시됩니다.
          </p>
        )}
        {state === "unsupported" && (
          <p className="helper-text" role="status">
            이 환경에서는 휴대폰 푸시를 지원하지 않습니다. 앱 안 알림을 이용해 주세요.
          </p>
        )}
        {state === "unavailable" && (
          <p className="helper-text" role="status">
            푸시 알림 설정을 준비 중입니다. 공지 게시판은 정상적으로 이용할 수 있습니다.
          </p>
        )}
        {state === "error" && (
          <p className="error-text" role="alert">
            알림 설정에 실패했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        )}
      </div>
      <button
        className="text-button push-opt-in-button"
        type="button"
        disabled={state === "subscribing"}
        onClick={() => void enablePush()}
      >
        {state === "subscribing" ? "설정 중…" : "새 공지 알림 받기"}
      </button>
    </div>
  );
}
