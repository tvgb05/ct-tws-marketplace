"use client";

import { CheckCircle2, KeyRound, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function AdminPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/auth/admin/password`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const message = Array.isArray(body?.message)
          ? body.message[0]
          : body?.message;
        setError(message ?? "Không thể đổi mật khẩu.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setSuccess("Đã đổi mật khẩu. Bạn sẽ được chuyển về trang đăng nhập.");
      window.setTimeout(() => window.location.assign("/login"), 1200);
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-password-panel admin-section-anchor" id="bao-mat">
      <div className="admin-password-heading">
        <span className="admin-password-icon">
          <KeyRound size={20} />
        </span>
        <div>
          <span className="section-kicker">BẢO MẬT TÀI KHOẢN</span>
          <h2>Đổi mật khẩu quản trị viên</h2>
          <p>Cần nhập đúng mật khẩu hiện tại trước khi đặt mật khẩu mới.</p>
        </div>
      </div>
      <form className="admin-password-form" onSubmit={submit}>
        <label>
          <span>Mật khẩu hiện tại</span>
          <input
            type="password"
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Mật khẩu mới</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Nhập lại mật khẩu mới</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </label>
        <small className="admin-password-requirement">
          Mật khẩu mới cần ít nhất 12 ký tự, có chữ hoa, chữ thường và chữ số.
        </small>
        {error && <p className="admin-form-message error">{error}</p>}
        {success && (
          <p className="admin-form-message success">
            <CheckCircle2 size={14} /> {success}
          </p>
        )}
        <button className="button button-primary" disabled={submitting}>
          {submitting ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <KeyRound size={16} />
          )}
          {submitting ? "Đang đổi…" : "Đổi mật khẩu"}
        </button>
      </form>
    </section>
  );
}
