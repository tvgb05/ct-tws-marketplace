"use client";

import { LoaderCircle, Megaphone } from "lucide-react";
import { FormEvent, useState } from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function AdminForumManager() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${apiUrl}/forum/posts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const body = (await response.json().catch(() => null)) as {
        notifiedUsers?: number;
        message?: string | string[];
      } | null;
      if (!response.ok) {
        const detail = Array.isArray(body?.message)
          ? body.message.join(" ")
          : body?.message;
        throw new Error(detail || "Không thể đăng thông tin forum.");
      }
      setMessage(
        `Đã đăng và gửi thông báo tới ${body?.notifiedUsers ?? 0} thành viên.`,
      );
      setTitle("");
      setContent("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể đăng thông tin forum.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-forum-panel">
      <header>
        <span className="admin-forum-icon">
          <Megaphone size={20} />
        </span>
        <div>
          <h2>Đăng thông tin lên Forum</h2>
          <p>
            Bài đăng xuất hiện trong FAQ và tạo một thông báo chưa đọc cho mọi
            tài khoản thành viên đang hoạt động.
          </p>
        </div>
      </header>
      <form onSubmit={submit}>
        <label>
          <span>Tiêu đề</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            minLength={4}
            maxLength={120}
            required
          />
        </label>
        <label>
          <span>Nội dung</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            minLength={10}
            maxLength={5000}
            rows={6}
            required
          />
        </label>
        {message && <p className="admin-form-message success">{message}</p>}
        {error && <p className="admin-form-message error">{error}</p>}
        <button className="button button-primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Megaphone size={17} />
          )}
          {busy ? "Đang đăng…" : "Đăng và thông báo toàn hệ thống"}
        </button>
      </form>
    </section>
  );
}
