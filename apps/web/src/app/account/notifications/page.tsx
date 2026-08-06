"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminTaggedText } from "@/components/admin-badge";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Notification = {
  id: string;
  title: string;
  message: string;
  targetUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

const relativeTime = (value: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`${apiUrl}/notifications`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.ok)
          setNotifications((await response.json()) as Notification[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const markRead = (notification: Notification) => {
    if (notification.readAt) return;
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
    void fetch(`${apiUrl}/notifications/${notification.id}/read`, {
      method: "POST",
      credentials: "include",
    }).then((response) => {
      if (response.ok) window.dispatchEvent(new Event("notifications:updated"));
    });
  };

  return (
    <main className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">CẬP NHẬT</span>
          <h1>Thông báo</h1>
          <p>
            Tên người mua, người bán và sản phẩm luôn được hiển thị trong thông
            báo giao dịch.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="notification-empty">Đang tải thông báo…</div>
      ) : notifications.length === 0 ? (
        <div className="notification-empty">
          Bạn chưa có thông báo giao dịch nào.
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <Link
              onClick={() => markRead(notification)}
              className={notification.readAt ? "" : "unread"}
              href={notification.targetUrl ?? "/account/notifications"}
              key={notification.id}
            >
              {!notification.readAt && <i />}
              <span>
                <strong>
                  <AdminTaggedText text={notification.title} />
                </strong>
                <small>
                  <AdminTaggedText text={notification.message} /> ·{" "}
                  {relativeTime(notification.createdAt)}
                </small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
