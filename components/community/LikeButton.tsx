"use client";
import { useRef, useState } from "react";
import { api, errorText } from "./shared";
export function LikeButton({ postId, initialLiked, initialCount }: { postId: string; initialLiked: boolean; initialCount: number }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  async function toggle() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      // Keep the previous state on failure; retry sends the same explicit intent.
      const next = await api<{ liked: boolean; likeCount: number }>(`/posts/${postId}/like`, "PUT", { liked: !liked });
      setLiked(next.liked); setCount(next.likeCount);
    } catch (error) { setMessage(errorText(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="community-likes">
    <button type="button" className={`community-like-button${liked ? " is-liked" : ""}`} aria-label="좋아요" aria-pressed={liked} aria-busy={busy} disabled={busy} onClick={() => void toggle()}>
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span> 좋아요 <span aria-live="polite" className="community-like-count">{count}</span>
    </button>
    {message && <p className="error-text" role="alert">{message}</p>}
  </div>;
}
