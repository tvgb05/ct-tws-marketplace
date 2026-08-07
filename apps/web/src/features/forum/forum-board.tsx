"use client";

import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MessagesSquare,
  RotateCcw,
  Search,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { relativeListingTime } from "@/lib/marketplace-types";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type ForumPost = {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  author: {
    id: string;
    displayName: string;
    role: "USER" | "ADMIN";
  };
};

type ForumPage = {
  items: ForumPost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function ForumBoard() {
  const [result, setResult] = useState<ForumPage | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "6",
      sort,
    });
    if (query) params.set("q", query);
    // Each filter/page change starts a new external request and resets its visible status.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFailed(false);
    void fetch(`${apiUrl}/forum/posts?${params}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const nextResult = (await response.json()) as ForumPage;
        setResult(nextResult);
        if (page > nextResult.totalPages) setPage(nextResult.totalPages);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query, sort]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput("");
    setQuery("");
    setSort("NEWEST");
    setPage(1);
  }

  const posts = result?.items ?? [];

  return (
    <section
      className="community-forum"
      id="forum"
      aria-labelledby="forum-title"
    >
      <div className="guidelines-section-heading">
        <span className="section-kicker">
          <MessagesSquare size={15} /> FORUM THÔNG TIN
        </span>
        <h2 id="forum-title">Cập nhật từ admin cộng đồng</h2>
        <p>
          Quy định mới, cảnh báo an toàn và hướng dẫn bổ sung sẽ được lưu tại
          đây. Mỗi bài mới đồng thời tạo thông báo cho mọi thành viên đang hoạt
          động.
        </p>
      </div>
      <form className="forum-controls" onSubmit={applySearch}>
        <label>
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            maxLength={100}
            placeholder="Tìm theo tiêu đề, nội dung hoặc admin…"
            aria-label="Tìm trong Forum"
          />
        </label>
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as "NEWEST" | "OLDEST");
            setPage(1);
          }}
          aria-label="Sắp xếp bài Forum"
        >
          <option value="NEWEST">Mới nhất</option>
          <option value="OLDEST">Cũ nhất</option>
        </select>
        <button type="submit" className="button button-primary">
          <Search size={15} /> Lọc
        </button>
        {(query || sort !== "NEWEST") && (
          <button
            type="button"
            className="forum-reset-filter"
            onClick={resetFilters}
          >
            <RotateCcw size={15} /> Đặt lại
          </button>
        )}
      </form>
      {loading && !result ? (
        <div className="forum-empty">
          <LoaderCircle className="spin" size={18} /> Đang tải forum…
        </div>
      ) : failed ? (
        <div className="forum-empty">Không thể tải thông tin forum.</div>
      ) : posts.length ? (
        <>
          <div className="forum-result-summary" aria-live="polite">
            <span>{result?.total ?? 0} bài phù hợp</span>
            {loading && (
              <span>
                <LoaderCircle className="spin" size={14} /> Đang cập nhật…
              </span>
            )}
          </div>
          <div className="forum-post-list" aria-busy={loading}>
            {posts.map((post) => (
              <article id={`forum-${post.id}`} key={post.id}>
                <header>
                  <span className="forum-post-icon">
                    <BellRing size={17} />
                  </span>
                  <div>
                    <h3>{post.title}</h3>
                    <small>
                      {post.author.displayName}{" "}
                      <AdminBadge role={post.author.role} />
                      <span>·</span> {relativeListingTime(post.publishedAt)}
                    </small>
                  </div>
                </header>
                <p>{post.content}</p>
              </article>
            ))}
          </div>
          {result && (
            <nav className="forum-pagination" aria-label="Phân trang Forum">
              <span>
                Trang {result.page}/{result.totalPages}
              </span>
              <div>
                <button
                  type="button"
                  disabled={loading || result.page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  aria-label="Trang Forum trước"
                >
                  <ChevronLeft size={17} /> Trước
                </button>
                <button
                  type="button"
                  disabled={loading || result.page >= result.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  aria-label="Trang Forum sau"
                >
                  Sau <ChevronRight size={17} />
                </button>
              </div>
            </nav>
          )}
        </>
      ) : (
        <div className="forum-empty">
          {query
            ? `Không tìm thấy bài Forum phù hợp với “${query}”.`
            : "Chưa có bài forum nào. Thông tin mới từ admin sẽ xuất hiện tại đây."}
        </div>
      )}
    </section>
  );
}
