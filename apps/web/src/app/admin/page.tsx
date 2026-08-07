"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  BadgeCheck,
  Flag,
  Handshake,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  Megaphone,
  Package,
  ShieldCheck,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminAccountManager } from "@/features/admin/admin-account-manager";
import { AdminForumManager } from "@/features/admin/admin-forum-manager";
import { AdminMediationQueue } from "@/features/admin/admin-mediation-queue";
import {
  AdminModerationQueues,
  AdminUserDirectory,
} from "@/features/admin/admin-moderation-dashboard";
import { AdminPasswordForm } from "@/features/admin/admin-password-form";
import { AdminTradeConfirmations } from "@/features/trade/admin-trade-confirmations";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/marketplace-types";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Overview = {
  listings: number;
  users: number;
  activeUsers: number;
  openReports: number;
  activeMediations: number;
};

const adminNavigation = [
  { href: "#tong-quan", label: "Tổng quan", icon: LayoutDashboard },
  { href: "#bao-mat", label: "Bảo mật", icon: KeyRound },
  {
    href: "#tai-khoan-quan-tri",
    label: "Tài khoản quản trị",
    icon: ShieldCheck,
  },
  { href: "#dien-dan-quan-tri", label: "Diễn đàn", icon: Megaphone },
  { href: "#mediation-queue", label: "Giao dịch trung gian", icon: Handshake },
  {
    href: "#xac-nhan-giao-dich",
    label: "Xác nhận hoàn tất",
    icon: BadgeCheck,
  },
  { href: "#quan-ly-thanh-vien", label: "Thành viên", icon: UsersRound },
  { href: "#hang-doi-bao-cao", label: "Báo cáo", icon: Flag },
] as const;

export default function AdminPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("tong-quan");

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    void fetch(`${apiUrl}/admin/overview`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.ok) setOverview((await response.json()) as Overview);
      })
      .finally(() => setLoading(false));
  }, [user?.role]);

  useEffect(() => {
    if (!overview) return;
    const elements = adminNavigation
      .map(({ href }) => document.getElementById(href.slice(1)))
      .filter((element): element is HTMLElement => Boolean(element));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-18% 0px -68%", threshold: [0, 0.15, 0.4] },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [overview]);

  if (!user) return null;
  if (user.role !== "ADMIN")
    return (
      <main className="dashboard-page">
        <div className="notification-empty">
          Tài khoản của bạn không có quyền truy cập trang quản trị.
        </div>
      </main>
    );

  const stats = overview
    ? [
        { icon: Package, value: overview.listings, label: "Bài đăng" },
        { icon: Users, value: overview.users, label: "Tổng tài khoản" },
        {
          icon: UserCheck,
          value: overview.activeUsers,
          label: "Hoạt động trong 30 ngày",
        },
        {
          icon: AlertTriangle,
          value: overview.openReports,
          label: "Báo cáo đang mở",
        },
        {
          icon: Handshake,
          value: overview.activeMediations,
          label: "Giao dịch trung gian",
        },
      ]
    : [];

  return (
    <main className="dashboard-page admin-dashboard-page">
      <div className="admin-dashboard-layout">
        <aside
          className="admin-side-navigation"
          aria-label="Điều hướng quản trị"
        >
          <div>
            <span className="section-kicker">BẢNG QUẢN TRỊ</span>
            <strong>Đi tới nội dung</strong>
          </div>
          <nav>
            {adminNavigation.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className={activeSection === href.slice(1) ? "active" : ""}
                aria-current={
                  activeSection === href.slice(1) ? "location" : undefined
                }
                onClick={() => setActiveSection(href.slice(1))}
              >
                <Icon size={17} /> <span>{label}</span>
              </a>
            ))}
          </nav>
          <small>Chỉ hiển thị cho tài khoản quản trị.</small>
        </aside>
        <div className="admin-dashboard-content">
          <div
            className="dashboard-heading admin-section-anchor"
            id="tong-quan"
          >
            <div>
              <span className="section-kicker">QUẢN TRỊ CỘNG ĐỒNG</span>
              <h1>Tổng quan chợ cộng đồng</h1>
              <p>Số liệu được tổng hợp trực tiếp từ cơ sở dữ liệu.</p>
            </div>
            <div className="admin-identity">
              <span className="avatar avatar-small">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initials(user.displayName)
                )}
              </span>
              <span>
                <strong>{user.displayName}</strong>
                <small>Tài khoản quản trị</small>
              </span>
              <b className="admin-tag">QUẢN TRỊ</b>
            </div>
          </div>
          {loading ? (
            <div className="notification-empty">
              <LoaderCircle className="spin" /> Đang tải số liệu…
            </div>
          ) : overview ? (
            <>
              <div className="admin-stats">
                {stats.map(({ icon: Icon, value, label }) => (
                  <article key={label}>
                    <Icon />
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <span>Số liệu hiện tại</span>
                  </article>
                ))}
              </div>
              <AdminPasswordForm />
              <AdminAccountManager />
              <AdminForumManager />
              <AdminMediationQueue />
              <div id="xac-nhan-giao-dich" className="admin-section-anchor">
                <AdminTradeConfirmations />
              </div>
              <AdminUserDirectory />
              <div id="hang-doi-bao-cao" className="admin-section-anchor">
                <AdminModerationQueues />
              </div>
            </>
          ) : (
            <div className="notification-empty">
              Không thể tải dữ liệu quản trị.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
