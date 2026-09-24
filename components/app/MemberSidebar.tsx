"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const memberNav = [
  { href: "/", label: "기도운동", icon: "🙏" },
  { href: "/visits", label: "심방신청", icon: "♡" },
  { href: "/prayer-requests", label: "기도요청", icon: "♥" },
  { href: "/notices", label: "공지", icon: "🔔" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MemberSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="member-nav" aria-label="56사랑 메뉴">
      {memberNav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`member-nav-link${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <span className="member-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
