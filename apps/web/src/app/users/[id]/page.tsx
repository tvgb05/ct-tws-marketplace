"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  LoaderCircle,
  PackageCheck,
  ShieldAlert,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { StarDisplay } from "@/components/star-display";
import { useAuth } from "@/lib/auth";
import { initials, relativeListingTime } from "@/lib/marketplace-types";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Profile = {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: "USER" | "ADMIN";
    joinedAt: string;
  };
  stats: {
    salesCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
  recentReviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    reviewer: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      role: "USER" | "ADMIN";
    };
    trade: { listing: { title: string; slug: string } };
  }>;
};

const reportReasons = [
  ["SUSPECTED_FRAUD", "Nghi ngờ lừa đảo"],
  ["IMPERSONATION", "Mạo danh người khác"],
  ["HARASSMENT", "Quấy rối hoặc xúc phạm"],
  ["SPAM", "Spam"],
  ["MISLEADING_PROFILE", "Thông tin hồ sơ gây hiểu nhầm"],
  ["OTHER", "Lý do khác"],
] as const;

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] =
    useState<(typeof reportReasons)[number][0]>("SUSPECTED_FRAUD");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    void fetch(`${apiUrl}/users/${params.id}/profile`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.ok) setProfile((await response.json()) as Profile);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  async function reportUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch(`${apiUrl}/users/${params.id}/reports`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description }),
      });
      const body = (await response.json().catch(() => null)) as {
        id?: string;
        message?: string | string[];
      } | null;
      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message[0]
          : body?.message;
        setFeedback(message ?? "Không thể gửi tố cáo.");
        return;
      }
      setFeedback("Phiếu tố cáo đã được gửi tới quản trị viên.");
      setDescription("");
    } catch {
      setFeedback("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className="user-profile-page">
        <div className="notification-empty">
          <LoaderCircle className="spin" /> Đang tải hồ sơ…
        </div>
      </main>
    );
  if (!profile)
    return (
      <main className="user-profile-page">
        <div className="notification-empty">Không tìm thấy thành viên.</div>
      </main>
    );

  const joined = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(profile.user.joinedAt));
  const isOwnProfile = currentUser?.id === profile.user.id;

  return (
    <main className="user-profile-page">
      <section className="public-profile-hero">
        <span className="avatar public-profile-avatar">
          {profile.user.avatarUrl ? (
            <img
              src={profile.user.avatarUrl}
              alt={profile.user.displayName}
              referrerPolicy="no-referrer"
            />
          ) : (
            initials(profile.user.displayName)
          )}
        </span>
        <div>
          <span className="section-kicker">HỒ SƠ THÀNH VIÊN</span>
          <span className="public-profile-name">
            <h1>{profile.user.displayName}</h1>
            <AdminBadge role={profile.user.role} />
          </span>
          <p>Tham gia chợ cộng đồng từ {joined}</p>
        </div>
        {!isOwnProfile && (
          <button
            className="button user-report-button"
            onClick={() => {
              setFeedback("");
              setReportOpen(true);
            }}
          >
            <ShieldAlert size={16} /> Tố cáo người dùng
          </button>
        )}
      </section>

      <section className="public-profile-stats">
        <article>
          <Star size={23} />
          <strong>{profile.stats.averageRating?.toFixed(1) ?? "—"}</strong>
          <span>Điểm đánh giá / 5</span>
        </article>
        <article>
          <PackageCheck size={23} />
          <strong>{profile.stats.salesCount}</strong>
          <span>Giao dịch bán hoàn tất</span>
        </article>
        <article>
          <Star size={23} />
          <strong>{profile.stats.reviewCount}</strong>
          <span>Lượt đánh giá xác thực</span>
        </article>
      </section>

      <section className="profile-reviews">
        <header>
          <div>
            <span className="section-kicker">ĐÁNH GIÁ GẦN ĐÂY</span>
            <h2>Trải nghiệm từ các giao dịch đã hoàn tất</h2>
          </div>
          {profile.stats.averageRating && (
            <StarDisplay value={profile.stats.averageRating} size={18} />
          )}
        </header>
        {profile.recentReviews.length ? (
          <div className="profile-review-list">
            {profile.recentReviews.map((review) => (
              <article key={review.id}>
                <div className="review-author">
                  <span className="avatar avatar-small">
                    {review.reviewer.avatarUrl ? (
                      <img
                        src={review.reviewer.avatarUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      initials(review.reviewer.displayName)
                    )}
                  </span>
                  <span>
                    <Link href={`/users/${review.reviewer.id}`}>
                      {review.reviewer.displayName}
                    </Link>
                    <AdminBadge role={review.reviewer.role} />
                    <small>{relativeListingTime(review.createdAt)}</small>
                  </span>
                </div>
                <StarDisplay value={review.rating} size={15} />
                {review.comment && <p>{review.comment}</p>}
                <Link
                  className="review-listing-link"
                  href={`/marketplace/${review.trade.listing.slug}`}
                >
                  Giao dịch: {review.trade.listing.title} →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="notification-empty">
            Thành viên chưa nhận được đánh giá nào.
          </div>
        )}
      </section>

      {reportOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setReportOpen(false)}
        >
          <form
            className="modal user-report-modal"
            onSubmit={reportUser}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setReportOpen(false)}
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
            <span className="modal-icon report-icon">
              <AlertTriangle />
            </span>
            <h2>Tố cáo {profile.user.displayName}</h2>
            <p>Phiếu sẽ được chuyển tới quản trị viên để xem xét.</p>
            <label>
              <span>Lý do</span>
              <select
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value as (typeof reportReasons)[number][0],
                  )
                }
              >
                {reportReasons.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Mô tả thêm</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                placeholder="Cung cấp thông tin giúp quản trị viên xác minh"
              />
            </label>
            {feedback && <p className="user-report-feedback">{feedback}</p>}
            <button className="button button-primary" disabled={submitting}>
              {submitting ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ShieldAlert size={16} />
              )}
              {submitting ? "Đang gửi…" : "Gửi phiếu tố cáo"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
