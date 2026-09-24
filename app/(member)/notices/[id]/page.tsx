import { notFound, redirect } from "next/navigation";
import { NoticeDetail } from "../../../../components/notices/NoticeDetail";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import {
  getPublishedNoticeForUser,
  markNoticeRead,
} from "../../../../src/features/notices/service";

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const notice = await getPublishedNoticeForUser(id, user.id);
  if (!notice) notFound();

  await markNoticeRead(id, user.id);

  return (
    <main className="shell">
      <NoticeDetail notice={{ ...notice, isUnread: false }} />
    </main>
  );
}
