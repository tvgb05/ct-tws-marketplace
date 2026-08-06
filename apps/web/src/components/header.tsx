"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Heart,
  LogOut,
  Menu,
  MessageSquareWarning,
  Moon,
  Plus,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminBadge } from "./admin-badge";
import { useAuth } from "@/lib/auth";
import { FEEDBACK_FORM_URL } from "@/lib/constants";
import { Logo } from "./logo";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, loading, logout } = useAuth();
  const visibleUnreadCount = user ? unreadCount : 0;
  const navItems = [
    { href: "/marketplace", label: "Khám phá" },
    { href: "/how-it-works", label: "Hướng dẫn" },
    { href: "/community-guidelines", label: "Quy tắc cộng đồng" },
    { href: "/account/listings", label: "Bài đăng của tôi" },
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: "Quản trị" }] : []),
  ];

  useEffect(() => {
    if (!user) return;
    const loadUnreadCount = async () => {
      const response = await fetch(`${apiUrl}/notifications/unread-count`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok)
        setUnreadCount(((await response.json()) as { count: number }).count);
    };
    void loadUnreadCount();
    window.addEventListener("notifications:updated", loadUnreadCount);
    return () =>
      window.removeEventListener("notifications:updated", loadUnreadCount);
  }, [user, pathname]);

  const toggleTheme = () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("tws-theme", nextTheme);
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav className={open ? "nav open" : "nav"}>
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-active" : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="header-actions">
          <button
            className="icon-button desktop-only theme-toggle"
            aria-label="Chuyển giao diện sáng hoặc tối"
            title="Chuyển giao diện sáng hoặc tối"
            onClick={toggleTheme}
          >
            <Moon className="theme-icon theme-icon-moon" size={19} />
            <Sun className="theme-icon theme-icon-sun" size={19} />
          </button>
          <Link
            href="/account/favorites"
            className="icon-button desktop-only"
            aria-label="Yêu thích"
          >
            <Heart size={19} />
          </Link>
          <Link
            href="/account/notifications"
            className="icon-button desktop-only notification"
            aria-label={
              visibleUnreadCount > 0
                ? `Thông báo, ${visibleUnreadCount} chưa đọc`
                : "Thông báo"
            }
          >
            <Bell size={19} />
            {visibleUnreadCount > 0 && <i />}
          </Link>
          <Link
            className="button button-primary post-button"
            href="/account/listings/new"
          >
            <Plus size={17} /> Đăng bán
          </Link>
          <div className="profile-menu">
            <button
              className="profile-trigger"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Mở menu tài khoản"
              aria-expanded={profileOpen}
            >
              <span className="avatar avatar-small">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initials(user?.displayName)
                )}
              </span>
              <span className="profile-name desktop-only">
                {loading ? "Đang tải…" : user?.displayName}
              </span>
              <AdminBadge role={user?.role} />
            </button>
            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-summary">
                  <span className="avatar avatar-small">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      initials(user?.displayName)
                    )}
                  </span>
                  <span>
                    <span className="identity-name-line">
                      <strong>{user?.displayName}</strong>
                      <AdminBadge role={user?.role} />
                    </span>
                    <small>
                      {user?.role === "ADMIN"
                        ? "Tài khoản quản trị"
                        : "Đăng nhập bằng Facebook"}
                    </small>
                  </span>
                </div>
                <Link href="/account" onClick={() => setProfileOpen(false)}>
                  <UserRound size={16} /> Tài khoản của tôi
                </Link>
                <a
                  href={FEEDBACK_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setProfileOpen(false)}
                >
                  <MessageSquareWarning size={16} /> Báo lỗi & góp ý
                </a>
                <button onClick={() => void logout()}>
                  <LogOut size={16} /> Đăng xuất
                </button>
              </div>
            )}
          </div>
          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Mở menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
