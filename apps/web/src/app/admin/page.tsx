"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  Handshake,
  LoaderCircle,
  Package,
  UserCheck,
  Users,
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

export default function AdminPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

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
    <main className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">QUẢN TRỊ CỘNG ĐỒNG</span>
          <h1>Tổng quan marketplace</h1>
          <p>Số liệu được tổng hợp trực tiếp từ database.</p>
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
          <b className="admin-tag">ADMIN</b>
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
                <span>Dữ liệu hiện tại</span>
              </article>
            ))}
          </div>
          <AdminPasswordForm />
          <AdminAccountManager />
          <AdminForumManager />
          {/* MarketplaceAdManager tạm thời được ẩn; API và dữ liệu quảng cáo được giữ nguyên. */}
          <AdminMediationQueue />
          <AdminTradeConfirmations />
          <AdminUserDirectory />
          <AdminModerationQueues />
        </>
      ) : (
        <div className="notification-empty">
          Không thể tải dữ liệu quản trị.
        </div>
      )}
    </main>
  );
}
