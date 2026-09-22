import { redirect } from "next/navigation";
import { LoginForm } from "../../components/auth/LoginForm";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";

export default async function LoginPage() {
  if (await getCurrentSessionUser()) redirect("/");
  return (
    <main className="shell auth-shell">
      <header className="hero-copy">
        <p className="eyebrow">함께 기도하는 한 달</p>
        <h1>기도운동 1달 도전</h1>
        <p>월요일부터 토요일까지 기도를 마치고 날짜를 체크해 주세요.</p>
      </header>
      <LoginForm />
    </main>
  );
}
