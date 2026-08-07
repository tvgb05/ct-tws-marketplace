"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { relativeListingTime } from "@/lib/marketplace-types";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Identity = {
  id: string;
  displayName: string;
  role: "USER" | "ADMIN";
};

type MediationRequest = {
  id: string;
  status: string;
  buyerNote: string | null;
  createdAt: string;
  listing: { id: string; slug: string; title: string };
  buyer: Identity;
  seller: Identity;
  admin: Identity | null;
  trade: {
    id: string;
    status: string;
    requestedQuantity: number;
    allocatedQuantity: number;
  } | null;
};

type PageResult = {
  items: MediationRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function AdminMediationQueue() {
  const [scope, setScope] = useState<"PENDING" | "MINE">("PENDING");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams({
      scope,
      page: String(page),
      pageSize: "10",
      ...(query && { q: query }),
    });
    void fetch(`${apiUrl}/mediation-requests/admin?${params}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setResult((await response.json()) as PageResult);
      })
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [page, query, scope]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setQuery(searchInput.trim());
  }

  async function assign(requestId: string) {
    setAssigning(requestId);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/mediation-requests/${requestId}/assign`,
        { method: "POST", credentials: "include" },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string | string[];
      } | null;
      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message[0]
          : body?.message;
        throw new Error(message ?? "Không thể nhận yêu cầu trung gian.");
      }
      setLoading(true);
      setRefreshKey((current) => current + 1);
      window.dispatchEvent(new Event("notifications:updated"));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể nhận yêu cầu trung gian.",
      );
    } finally {
      setAssigning(null);
    }
  }

  return (
    <section className="admin-table admin-mediation-queue" id="mediation-queue">
      <div>
        <div>
          <h2>Phân công giao dịch trung gian</h2>
          <p>
            Tất cả admin thấy hàng chờ. Admin bấm nhận sẽ chịu trách nhiệm độc
            quyền cho giao dịch đó.
          </p>
        </div>
        <ShieldCheck size={20} />
      </div>
      <form className="admin-table-controls" onSubmit={search}>
        <label>
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm sản phẩm, người mua hoặc người bán"
            maxLength={100}
          />
        </label>
        <select
          value={scope}
          onChange={(event) => {
            setLoading(true);
            setScope(event.target.value as "PENDING" | "MINE");
            setPage(1);
          }}
          aria-label="Lọc yêu cầu trung gian"
        >
          <option value="PENDING">Chưa có admin nhận</option>
          <option value="MINE">Tôi đang phụ trách</option>
        </select>
        <button type="submit">Tìm kiếm</button>
      </form>
      {error && <p className="admin-mediation-error">{error}</p>}
      {loading ? (
        <div className="notification-empty">
          <LoaderCircle className="spin" size={18} /> Đang tải yêu cầu…
        </div>
      ) : result?.items.length ? (
        <>
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Giao dịch</th>
                  <th>Người mua / người bán</th>
                  <th>Số lượng</th>
                  <th>Thời gian</th>
                  <th>Phụ trách</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <Link href={`/marketplace/${request.listing.slug}`}>
                        <strong>{request.listing.title}</strong>
                      </Link>
                      <small>
                        Yêu cầu #{request.id.slice(-8).toUpperCase()}
                        {request.buyerNote ? ` · ${request.buyerNote}` : ""}
                      </small>
                    </td>
                    <td>
                      <span className="identity-name-line">
                        <Link href={`/users/${request.buyer.id}`}>
                          {request.buyer.displayName}
                        </Link>
                        <AdminBadge role={request.buyer.role} />
                      </span>
                      <small>
                        mua từ{" "}
                        <Link href={`/users/${request.seller.id}`}>
                          {request.seller.displayName}
                        </Link>
                      </small>
                    </td>
                    <td>
                      {request.trade?.allocatedQuantity ?? 0} /{" "}
                      {request.trade?.requestedQuantity ?? 0}
                      <small>{request.trade?.status ?? "Chưa tạo đơn"}</small>
                    </td>
                    <td>{relativeListingTime(request.createdAt)}</td>
                    <td>
                      {scope === "PENDING" ? (
                        <button
                          className="mediation-assign-button"
                          onClick={() => void assign(request.id)}
                          disabled={assigning === request.id}
                        >
                          {assigning === request.id ? (
                            <LoaderCircle className="spin" size={15} />
                          ) : (
                            <CheckCircle2 size={15} />
                          )}
                          Duyệt và nhận
                        </button>
                      ) : request.admin ? (
                        <span className="identity-name-line">
                          <Link href={`/users/${request.admin.id}`}>
                            {request.admin.displayName}
                          </Link>
                          <AdminBadge role={request.admin.role} />
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>
              Trang {result.page}/{result.totalPages} · {result.total} yêu cầu
            </span>
            <div>
              <button
                type="button"
                disabled={result.page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => current - 1);
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={result.page >= result.totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => current + 1);
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="notification-empty">
          {scope === "PENDING"
            ? "Không có yêu cầu nào đang chờ admin nhận."
            : "Bạn chưa nhận phụ trách giao dịch nào."}
        </div>
      )}
    </section>
  );
}
