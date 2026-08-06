"use client";

import { CheckCircle2, LoaderCircle, Star } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { StarDisplay } from "@/components/star-display";
import { useAuth } from "@/lib/auth";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Identity = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
};
type TradeReview = {
  id: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};
type Trade = {
  id: string;
  status: string;
  buyer: Identity;
  seller: Identity;
  listing: { id: string; title: string; slug: string };
  reviews: TradeReview[];
};

function ReviewCard({
  trade,
  currentUserId,
  onReviewed,
}: {
  trade: Trade;
  currentUserId: string;
  onReviewed: (tradeId: string, review: TradeReview) => void;
}) {
  const counterpart =
    trade.buyer.id === currentUserId ? trade.seller : trade.buyer;
  const ownReview = trade.reviews.find(
    (review) => review.reviewerId === currentUserId,
  );
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/trades/${trade.id}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const body = (await response.json().catch(() => null)) as
        | (TradeReview & { message?: string | string[] })
        | null;
      if (!response.ok || !body?.id) {
        const message = Array.isArray(body?.message)
          ? body.message[0]
          : body?.message;
        setError(message ?? "Không thể gửi đánh giá.");
        return;
      }
      onReviewed(trade.id, body);
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="trade-review-card">
      <header>
        <div>
          <small>GIAO DỊCH ĐÃ HOÀN TẤT</small>
          <Link href={`/marketplace/${trade.listing.slug}`}>
            {trade.listing.title}
          </Link>
        </div>
        <Link className="review-counterpart" href={`/users/${counterpart.id}`}>
          <span>
            <strong>{counterpart.displayName}</strong>
            <AdminBadge role={counterpart.role} />
          </span>
          <small>Xem hồ sơ →</small>
        </Link>
      </header>
      {ownReview ? (
        <div className="review-complete-state">
          <CheckCircle2 size={18} />
          <span>
            <strong>Bạn đã đánh giá giao dịch này</strong>
            <StarDisplay value={ownReview.rating} size={14} />
            {ownReview.comment && <small>{ownReview.comment}</small>}
          </span>
        </div>
      ) : (
        <form className="trade-review-form" onSubmit={submit}>
          <div className="rating-picker" aria-label="Chọn số sao">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={star <= rating ? "active" : ""}
                aria-label={`${star} sao`}
                onClick={() => setRating(star)}
              >
                <Star
                  size={20}
                  fill={star <= rating ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            placeholder="Chia sẻ trải nghiệm giao dịch (không bắt buộc)"
          />
          {error && <p className="admin-form-message error">{error}</p>}
          <button className="button button-primary" disabled={submitting}>
            {submitting ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Star size={16} />
            )}
            {submitting ? "Đang gửi…" : "Gửi đánh giá"}
          </button>
        </form>
      )}
    </article>
  );
}

export function TradeReviewPanel() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/trades/mine`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) setTrades((await response.json()) as Trade[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const completedTrades = useMemo(
    () =>
      trades.filter(
        (trade) =>
          trade.status === "COMPLETED" &&
          (trade.buyer.id === user?.id || trade.seller.id === user?.id),
      ),
    [trades, user?.id],
  );

  if (!user) return null;
  return (
    <section className="trade-review-panel">
      <div className="trade-review-heading">
        <div>
          <span className="section-kicker">UY TÍN CỘNG ĐỒNG</span>
          <h2>Đánh giá sau giao dịch</h2>
          <p>
            Chỉ người mua và người bán trong giao dịch đã hoàn tất mới có thể
            đánh giá nhau.
          </p>
        </div>
        <Star size={26} />
      </div>
      {loading ? (
        <div className="notification-empty">
          <LoaderCircle className="spin" size={17} /> Đang tải giao dịch…
        </div>
      ) : completedTrades.length ? (
        <div className="trade-review-list">
          {completedTrades.map((trade) => (
            <ReviewCard
              key={trade.id}
              trade={trade}
              currentUserId={user.id}
              onReviewed={(tradeId, review) =>
                setTrades((current) =>
                  current.map((item) =>
                    item.id === tradeId
                      ? { ...item, reviews: [...item.reviews, review] }
                      : item,
                  ),
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="notification-empty">
          Chưa có giao dịch hoàn tất để đánh giá.
        </div>
      )}
    </section>
  );
}
