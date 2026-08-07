"use client";

import { ChevronLeft, ChevronRight, LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { relativeListingTime } from "@/lib/marketplace-types";
import {
  AdminUserReportActions,
  RestorePostingPermissionButton,
} from "./admin-user-moderation-actions";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ManagedUser = {
  id: string;
  displayName: string;
  email: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  lastLoginAt: string | null;
  canPostListings: boolean;
  postingRestrictionReason: string | null;
  postingRestrictedAt: string | null;
};

type Identity = {
  id: string;
  displayName: string;
  role: "USER" | "ADMIN";
};

type UserReport = {
  id: string;
  reason: string;
  description: string | null;
  status: "OPEN" | "REVIEWING";
  createdAt: string;
  reporter: Identity;
  reportedUser: Identity & {
    canPostListings: boolean;
    postingRestrictionReason: string | null;
  };
};

type ListingReport = {
  id: string;
  reason: string;
  description: string | null;
  status: "OPEN" | "REVIEWING";
  createdAt: string;
  reporter: Identity;
  listing: { id: string; slug: string; title: string };
};

const userReportReasonLabel: Record<string, string> = {
  SUSPECTED_FRAUD: "Nghi ngờ lừa đảo",
  IMPERSONATION: "Mạo danh",
  HARASSMENT: "Quấy rối",
  SPAM: "Spam",
  MISLEADING_PROFILE: "Hồ sơ gây hiểu nhầm",
  OTHER: "Khác",
};

const listingReportReasonLabel: Record<string, string> = {
  SPAM: "Spam",
  MISLEADING_INFORMATION: "Thông tin gây hiểu nhầm",
  SUSPICIOUS_SELLER: "Người bán đáng ngờ",
  POSSIBLE_SCAM: "Có thể lừa đảo",
  INAPPROPRIATE_CONTENT: "Nội dung không phù hợp",
  DUPLICATE_LISTING: "Bài đăng trùng",
  ALREADY_SOLD: "Sản phẩm đã bán",
  OTHER: "Khác",
};

function Pager({
  result,
  onPage,
}: {
  result: PageResult<unknown>;
  onPage: (page: number) => void;
}) {
  return (
    <div className="admin-pagination">
      <span>
        Trang {result.page}/{result.totalPages} · {result.total} kết quả
      </span>
      <div>
        <button
          type="button"
          disabled={result.page <= 1}
          onClick={() => onPage(result.page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          disabled={result.page >= result.totalPages}
          onClick={() => onPage(result.page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function AdminUserDirectory() {
  const [scope, setScope] = useState<"RECENT" | "RESTRICTED">("RECENT");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<PageResult<ManagedUser> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const params = new URLSearchParams({
      scope,
      page: String(page),
      pageSize: "10",
      ...(query && { q: query }),
    });
    void fetch(`${apiUrl}/admin/users?${params}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setResult((await response.json()) as PageResult<ManagedUser>);
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
    setQuery(searchInput.trim());
    setPage(1);
  }

  return (
    <section className="admin-table admin-user-directory">
      <div>
        <h2>Quản lý tài khoản thành viên</h2>
        <p>
          “Hoạt động gần đây” dựa trên lần đăng nhập trong 30 ngày, không phải
          trạng thái online thời gian thực.
        </p>
      </div>
      <form className="admin-table-controls" onSubmit={search}>
        <label>
          <span className="sr-only">Tìm tài khoản</span>
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm theo tên hoặc email"
            maxLength={100}
          />
        </label>
        <select
          value={scope}
          onChange={(event) => {
            setLoading(true);
            setScope(event.target.value as "RECENT" | "RESTRICTED");
            setPage(1);
          }}
          aria-label="Lọc tài khoản"
        >
          <option value="RECENT">Hoạt động trong 30 ngày</option>
          <option value="RESTRICTED">Đang bị khóa quyền đăng</option>
        </select>
        <button type="submit">Tìm kiếm</button>
      </form>
      {loading ? (
        <div className="notification-empty">
          <LoaderCircle className="spin" size={18} /> Đang tải tài khoản…
        </div>
      ) : result?.items.length ? (
        <>
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Thành viên</th>
                  <th>Vai trò/trạng thái</th>
                  <th>
                    {scope === "RECENT" ? "Lần đăng nhập cuối" : "Lý do khóa"}
                  </th>
                  {scope === "RESTRICTED" && <th>Thời gian khóa</th>}
                  {scope === "RESTRICTED" && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {result.items.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <Link href={`/users/${member.id}`}>
                        {member.displayName}
                      </Link>
                      {member.email && <small>{member.email}</small>}
                    </td>
                    <td>
                      <span className="identity-name-line">
                        {member.status === "ACTIVE"
                          ? "Đang hoạt động"
                          : member.status}
                        <AdminBadge role={member.role} />
                      </span>
                    </td>
                    <td>
                      {scope === "RECENT"
                        ? member.lastLoginAt
                          ? relativeListingTime(member.lastLoginAt)
                          : "Chưa ghi nhận"
                        : member.postingRestrictionReason ||
                          "Vi phạm quy tắc cộng đồng"}
                    </td>
                    {scope === "RESTRICTED" && (
                      <td>
                        {member.postingRestrictedAt
                          ? relativeListingTime(member.postingRestrictedAt)
                          : "Không rõ"}
                      </td>
                    )}
                    {scope === "RESTRICTED" && (
                      <td>
                        <RestorePostingPermissionButton
                          userId={member.id}
                          onRestored={() => {
                            setLoading(true);
                            setRefreshKey((current) => current + 1);
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            result={result}
            onPage={(nextPage) => {
              setLoading(true);
              setPage(nextPage);
            }}
          />
        </>
      ) : (
        <div className="notification-empty">
          Không tìm thấy tài khoản phù hợp.
        </div>
      )}
    </section>
  );
}

function AdminReportQueue({ kind }: { kind: "user" | "listing" }) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "OPEN" | "REVIEWING">("ALL");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<PageResult<
    UserReport | ListingReport
  > | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      status,
      ...(query && { q: query }),
    });
    void fetch(
      `${apiUrl}/admin/${kind === "user" ? "user-reports" : "listing-reports"}?${params}`,
      { credentials: "include", cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setResult(
          (await response.json()) as PageResult<UserReport | ListingReport>,
        );
      })
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [kind, page, query, status]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setQuery(searchInput.trim());
    setPage(1);
  }

  return (
    <section className="admin-table admin-report-queue">
      <div>
        <h2>
          {kind === "user"
            ? "Tố cáo người dùng đang chờ xử lý"
            : "Báo cáo bài đăng đang chờ xử lý"}
        </h2>
      </div>
      <form className="admin-table-controls" onSubmit={search}>
        <label>
          <span className="sr-only">Tìm báo cáo</span>
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={
              kind === "user"
                ? "Tìm tên người gửi hoặc bị tố cáo"
                : "Tìm sản phẩm hoặc người gửi"
            }
            maxLength={100}
          />
        </label>
        <select
          value={status}
          onChange={(event) => {
            setLoading(true);
            setStatus(event.target.value as "ALL" | "OPEN" | "REVIEWING");
            setPage(1);
          }}
          aria-label="Lọc trạng thái báo cáo"
        >
          <option value="ALL">Tất cả đang chờ</option>
          <option value="OPEN">Chưa xem</option>
          <option value="REVIEWING">Đang xem</option>
        </select>
        <button type="submit">Tìm kiếm</button>
      </form>
      {loading ? (
        <div className="notification-empty">
          <LoaderCircle className="spin" size={18} /> Đang tải báo cáo…
        </div>
      ) : result?.items.length ? (
        <>
          <div className="admin-table-scroll">
            {kind === "user" ? (
              <table>
                <thead>
                  <tr>
                    <th>Người bị tố cáo</th>
                    <th>Lý do/mô tả</th>
                    <th>Người gửi</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                    <th>Xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.items as UserReport[]).map((report) => (
                    <tr key={report.id}>
                      <td>
                        <Link
                          className="identity-name-line"
                          href={`/users/${report.reportedUser.id}`}
                        >
                          {report.reportedUser.displayName}
                          <AdminBadge role={report.reportedUser.role} />
                        </Link>
                      </td>
                      <td>
                        <strong>
                          {userReportReasonLabel[report.reason] ??
                            report.reason}
                        </strong>
                        <small>{report.description || "Không có mô tả"}</small>
                      </td>
                      <td>
                        <Link
                          className="identity-name-line"
                          href={`/users/${report.reporter.id}`}
                        >
                          {report.reporter.displayName}
                          <AdminBadge role={report.reporter.role} />
                        </Link>
                      </td>
                      <td>{relativeListingTime(report.createdAt)}</td>
                      <td>
                        <span
                          className={`status-badge ${report.status === "OPEN" ? "warning" : ""}`}
                        >
                          {report.status === "OPEN" ? "Chưa xem" : "Đang xem"}
                        </span>
                      </td>
                      <td>
                        <AdminUserReportActions
                          reportId={report.id}
                          onResolved={() => {
                            setLoading(true);
                            setRefreshKey((current) => current + 1);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Lý do/mô tả</th>
                    <th>Người gửi</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.items as ListingReport[]).map((report) => (
                    <tr key={report.id}>
                      <td>
                        <Link href={`/marketplace/${report.listing.slug}`}>
                          {report.listing.title}
                        </Link>
                      </td>
                      <td>
                        <strong>
                          {listingReportReasonLabel[report.reason] ??
                            report.reason}
                        </strong>
                        <small>{report.description || "Không có mô tả"}</small>
                      </td>
                      <td>
                        <Link
                          className="identity-name-line"
                          href={`/users/${report.reporter.id}`}
                        >
                          {report.reporter.displayName}
                          <AdminBadge role={report.reporter.role} />
                        </Link>
                      </td>
                      <td>{relativeListingTime(report.createdAt)}</td>
                      <td>
                        <span
                          className={`status-badge ${report.status === "OPEN" ? "warning" : ""}`}
                        >
                          {report.status === "OPEN" ? "Chưa xem" : "Đang xem"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pager
            result={result}
            onPage={(nextPage) => {
              setLoading(true);
              setPage(nextPage);
            }}
          />
        </>
      ) : (
        <div className="notification-empty">Không có báo cáo phù hợp.</div>
      )}
    </section>
  );
}

export function AdminModerationQueues() {
  return (
    <>
      <AdminReportQueue kind="user" />
      <AdminReportQueue kind="listing" />
    </>
  );
}
