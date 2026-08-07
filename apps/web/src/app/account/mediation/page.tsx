"use client";

import { Clock3, LoaderCircle, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { ADMIN_FACEBOOK_URL } from "@/lib/constants";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type MediationRequest = {
  id: string;
  status: string;
  createdAt: string;
  listing: { slug: string; title: string };
  buyer: { id: string; displayName: string; role: "USER" | "ADMIN" };
  seller: { id: string; displayName: string; role: "USER" | "ADMIN" };
  admin: { id: string; displayName: string; role: "USER" | "ADMIN" } | null;
};
const statusLabel: Record<string, string> = {
  REQUESTED: "Chờ admin duyệt",
  SELLER_ACCEPTED: "Chờ admin",
  SELLER_REJECTED: "Người bán từ chối",
  ADMIN_ASSIGNED: "Đã có admin",
  IN_PROGRESS: "Đang xử lý",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

export default function MediationPage() {
  const [requests, setRequests] = useState<MediationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetch(`${apiUrl}/mediation-requests/mine`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.ok)
          setRequests((await response.json()) as MediationRequest[]);
      })
      .finally(() => setLoading(false));
  }, []);
  return (
    <main className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">HỖ TRỢ GIAO DỊCH</span>
          <h1>Yêu cầu trung gian</h1>
          <p>
            Danh sách yêu cầu trung gian thực tế liên quan đến tài khoản của
            bạn.
          </p>
        </div>
        <a
          className="support-admin"
          href={ADMIN_FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/brand/admin-profile.png"
            alt="Admin phụ trách hỗ trợ"
            width={54}
            height={54}
          />
          <span>
            <small>ADMIN PHỤ TRÁCH</small>
            <strong>Liên hệ qua Facebook ↗</strong>
          </span>
        </a>
      </div>
      {loading ? (
        <div className="notification-empty">
          <LoaderCircle className="spin" /> Đang tải yêu cầu…
        </div>
      ) : requests.length ? (
        <div className="mediation-list">
          {requests.map((request) => (
            <article className="mediation-card" key={request.id}>
              <span className="mediation-icon">
                <ShieldCheck />
              </span>
              <div>
                <small>YÊU CẦU #{request.id.slice(-8).toUpperCase()}</small>
                <h3>
                  <Link href={`/marketplace/${request.listing.slug}`}>
                    {request.listing.title}
                  </Link>
                </h3>
                <p>
                  <span className="identity-name-line">
                    <Link href={`/users/${request.buyer.id}`}>
                      {request.buyer.displayName}
                    </Link>
                    <AdminBadge role={request.buyer.role} />
                  </span>{" "}
                  mua từ{" "}
                  <span className="identity-name-line">
                    <Link href={`/users/${request.seller.id}`}>
                      {request.seller.displayName}
                    </Link>
                    <AdminBadge role={request.seller.role} />
                  </span>
                  {request.admin && (
                    <>
                      {" · Phụ trách: "}
                      <span className="identity-name-line">
                        <Link href={`/users/${request.admin.id}`}>
                          {request.admin.displayName}
                        </Link>
                        <AdminBadge role={request.admin.role} />
                      </span>
                    </>
                  )}
                </p>
              </div>
              <span className="status-badge">
                <Clock3 size={13} />{" "}
                {statusLabel[request.status] ?? request.status}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="notification-empty">
          Bạn chưa có yêu cầu trung gian nào.
        </div>
      )}
    </main>
  );
}
