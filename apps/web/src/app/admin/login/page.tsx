"use client";

import {
  ArrowLeft,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function AdminLoginPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user)
      router.replace(user.role === "ADMIN" ? "/admin" : "/marketplace");
  }, [loading, router, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/admin/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Bạn đã thử quá nhiều lần. Vui lòng đợi một phút rồi thử lại."
            : "Email hoặc mật khẩu không chính xác.",
        );
        return;
      }
      const authenticatedUser = (await response.json()) as {
        role: "USER" | "ADMIN";
      };
      await refresh();
      window.location.assign(
        authenticatedUser.role === "ADMIN" ? "/admin" : "/marketplace",
      );
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page admin-auth-page">
      <div className="auth-art">
        <Image
          src="/brand/earbuds-hero.png"
          alt="Tai nghe không dây bên bờ biển"
          fill
          sizes="50vw"
          priority
        />
        <div className="auth-quote admin-auth-quote">
          <ShieldCheck size={30} />
          <p>Khu vực điều hành và bảo vệ cộng đồng marketplace.</p>
          <small>TWS Community Market · Admin</small>
        </div>
      </div>
      <div className="auth-form">
        <Link href="/login" className="back-link">
          <ArrowLeft size={15} /> Về đăng nhập thành viên
        </Link>
        <form className="auth-box admin-login-form" onSubmit={submit}>
          <span className="auth-kicker">ĐĂNG NHẬP EMAIL</span>
          <h1>
            Đăng nhập
            <br />
            <em>bằng tài khoản nội bộ.</em>
          </h1>
          <p>
            Dành cho admin và tài khoản thành viên demo được cấp sẵn. Quyền truy
            cập vẫn được kiểm tra theo đúng vai trò của từng tài khoản.
          </p>
          <label className="admin-form-field">
            <span>Email đăng nhập</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="admin-form-field">
            <span>Mật khẩu</span>
            <input
              type="password"
              autoComplete="current-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label className="remember-login admin-remember-login">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>
              <strong>Duy trì đăng nhập trong 30 ngày</strong>
              <small>Chỉ nên chọn trên thiết bị cá nhân an toàn.</small>
            </span>
          </label>
          {error && <div className="admin-auth-error">{error}</div>}
          <button
            type="submit"
            className="admin-login-submit"
            disabled={submitting || loading}
          >
            {submitting ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <LockKeyhole size={18} />
            )}
            {submitting ? "Đang đăng nhập…" : "Đăng nhập bằng email"}
          </button>
          <div className="auth-security">
            <ShieldCheck size={18} />
            <span>
              <strong>Phiên quản trị được bảo vệ</strong>
              <small>
                Mật khẩu được mã hóa và phiên nằm trong cookie HTTP-only.
              </small>
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}
