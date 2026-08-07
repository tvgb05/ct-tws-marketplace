"use client";

import { BellRing, LoaderCircle, MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
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

export function ForumBoard() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void fetch(`${apiUrl}/forum/posts`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setPosts((await response.json()) as ForumPost[]);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

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
      {loading ? (
        <div className="forum-empty">
          <LoaderCircle className="spin" size={18} /> Đang tải forum…
        </div>
      ) : failed ? (
        <div className="forum-empty">Không thể tải thông tin forum.</div>
      ) : posts.length ? (
        <div className="forum-post-list">
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
      ) : (
        <div className="forum-empty">
          Chưa có bài forum nào. Thông tin mới từ admin sẽ xuất hiện tại đây.
        </div>
      )}
    </section>
  );
}
