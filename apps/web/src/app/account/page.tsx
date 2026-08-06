"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Bell,
  ChevronRight,
  Heart,
  Package,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AdminBadge } from "@/components/admin-badge";
import { TradeReviewPanel } from "@/features/trade/trade-review-panel";
import { initials, MarketplaceListing } from "@/lib/marketplace-types";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const links = [
  {
    href: "/account/listings",
    icon: Package,
    title: "Bài đăng của tôi",
    text: "Quản lý sản phẩm đang bán",
  },
  {
    href: "/account/favorites",
    icon: Heart,
    title: "Đã lưu",
    text: "Những món đồ bạn quan tâm",
  },
  {
    href: "/account/mediation",
    icon: ShieldCheck,
    title: "Yêu cầu trung gian",
    text: "Theo dõi hỗ trợ từ admin",
  },
  {
    href: "/account/notifications",
    icon: Bell,
    title: "Thông báo",
    text: "Cập nhật hoạt động gần đây",
  },
];

export default function AccountPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [activeMediations, setActiveMediations] = useState(0);

  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/listings/mine`, {
        credentials: "include",
        cache: "no-store",
      }),
      fetch(`${apiUrl}/mediation-requests/mine`, {
        credentials: "include",
        cache: "no-store",
      }),
    ]).then(async ([listingResponse, mediationResponse]) => {
      if (listingResponse.ok)
        setListings((await listingResponse.json()) as MarketplaceListing[]);
      if (mediationResponse.ok) {
        const requests = (await mediationResponse.json()) as Array<{
          status: string;
        }>;
        setActiveMediations(
          requests.filter((request) =>
            [
              "REQUESTED",
              "SELLER_ACCEPTED",
              "ADMIN_ASSIGNED",
              "IN_PROGRESS",
            ].includes(request.status),
          ).length,
        );
      }
    });
  }, []);

  if (!user) return null;
  const joined = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(user.joinedAt));
  return (
    <main className="dashboard-page">
      <section className="account-hero">
        <div className="avatar account-avatar">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              referrerPolicy="no-referrer"
            />
          ) : (
            initials(user.displayName)
          )}
        </div>
        <div>
          <span>TÀI KHOẢN CỘNG ĐỒNG</span>
          <span className="account-name-line">
            <h1>Xin chào, {user.displayName}</h1>
            <AdminBadge role={user.role} />
          </span>
          <p>
            {user.role === "ADMIN"
              ? "Tài khoản quản trị"
              : "Đăng nhập qua Facebook"}{" "}
            · Tham gia marketplace từ {joined}
          </p>
        </div>
        <Link
          href={
            user.role === "ADMIN" ? "/admin" : "/complete-profile?next=/account"
          }
          className="button button-outline"
        >
          <UserRound size={16} />
          {user.role === "ADMIN" ? "Mở trang quản trị" : "Cập nhật hồ sơ"}
        </Link>
      </section>
      <div className="account-layout">
        <section>
          <span className="section-kicker">QUẢN LÝ CỦA BẠN</span>
          <h2>Mọi hoạt động, một nơi</h2>
          <div className="account-link-grid">
            {links.map(({ href, icon: Icon, title, text }) => (
              <Link href={href} key={href}>
                <Icon />
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </section>
        <aside className="account-stats">
          <span className="section-kicker light">DỮ LIỆU TÀI KHOẢN</span>
          <div>
            <strong>
              {
                listings.filter((item) =>
                  ["AVAILABLE", "RESERVED"].includes(item.status),
                ).length
              }
            </strong>
            <small>Bài đang bán</small>
          </div>
          <div>
            <strong>
              {listings.filter((item) => item.status === "SOLD").length}
            </strong>
            <small>Món đã bán</small>
          </div>
          <div>
            <strong>{activeMediations}</strong>
            <small>Yêu cầu đang xử lý</small>
          </div>
        </aside>
      </div>
      <TradeReviewPanel />
    </main>
  );
}
