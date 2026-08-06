"use client";

import {
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const apiOrigin =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1$/, "") ??
  "http://localhost:4000";
const apiUrl = `${apiOrigin}/api/v1`;

function apiErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object" || !("message" in body)) return fallback;
  const message = (body as { message?: string | string[] }).message;
  return Array.isArray(message) ? (message[0] ?? fallback) : (message ?? fallback);
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const [rememberForThirtyDays, setRememberForThirtyDays] = useState(false);
  const [emailStep, setEmailStep] = useState<"request" | "verify">("request");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [contactPrivacyAccepted, setContactPrivacyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [methods, setMethods] = useState<{
    google: boolean;
    emailOtp: boolean;
  } | null>(null);
  const router = useRouter();
  const requestedPath =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("next");
  const nextPath = requestedPath?.startsWith("/")
    ? requestedPath
    : "/marketplace";

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "ADMIN") router.replace("/admin");
      else
        router.replace(
          user.profileCompleted
            ? nextPath
            : `/complete-profile?next=${encodeURIComponent(nextPath)}`,
        );
    }
  }, [loading, user, router, nextPath]);

  useEffect(() => {
    void fetch(`${apiUrl}/auth/methods`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setMethods(
          (await response.json()) as { google: boolean; emailOtp: boolean },
        );
      })
      .catch(() => setMethods({ google: false, emailOtp: false }));
  }, []);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/auth/email/request-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, contactPrivacyAccepted }),
      });
      const body = (await response.json().catch(() => null)) as {
        devCode?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          apiErrorMessage(body, "Không thể gửi mã. Vui lòng thử lại."),
        );
      setEmailStep("verify");
      setMessage(
        body?.devCode
          ? `Môi trường phát triển: mã OTP là ${body.devCode}`
          : `Đã gửi mã tới ${email.trim().toLowerCase()}. Hãy kiểm tra cả Hộp thư đến và Spam/Thư rác; người gửi hiển thị là taskflow-planner.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể gửi mã.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/email/verify-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          displayName,
          remember: rememberForThirtyDays,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        profileCompleted?: boolean;
      } | null;
      if (!response.ok)
        throw new Error(
          apiErrorMessage(body, "Mã OTP không hợp lệ hoặc đã hết hạn."),
        );
      window.location.assign(
        body?.profileCompleted
          ? nextPath
          : `/complete-profile?next=${encodeURIComponent(nextPath)}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể xác nhận mã OTP.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-art">
        <Image
          src="/brand/earbuds-hero.png"
          alt="Tai nghe không dây bên bờ biển"
          fill
          sizes="50vw"
          priority
        />
        <div className="auth-quote">
          <span>“</span>
          <p>
            Những món đồ tốt xứng đáng có thêm một vòng đời, cùng người thực sự
            cần chúng.
          </p>
          <small>TWS Community Market</small>
        </div>
      </div>
      <div className="auth-form">
        <div className="auth-box">
          <span className="auth-kicker">CHÀO MỪNG BẠN</span>
          <h1>
            Tham gia cộng đồng
            <br />
            <em>mua bán tử tế.</em>
          </h1>
          <p>
            Đăng nhập nhanh bằng Google hoặc nhận mã xác nhận qua email. Chúng
            tôi không yêu cầu mật khẩu email của bạn.
          </p>
          {loading ? (
            <div className="auth-loading">
              <LoaderCircle className="spin" /> Đang kiểm tra phiên đăng nhập…
            </div>
          ) : (
            <>
              {methods?.google ? (
                <a
                  href={`${apiOrigin}/api/v1/auth/google/start?remember=${rememberForThirtyDays ? "1" : "0"}`}
                  className="google-login-button"
                >
                  <span aria-hidden="true">G</span> Tiếp tục với Google
                </a>
              ) : (
                <div className="google-login-button disabled">
                  <span aria-hidden="true">G</span>{" "}
                  {methods
                    ? "Google chưa được cấu hình"
                    : "Đang kiểm tra Google…"}
                </div>
              )}
              <div className="auth-divider">
                <span>hoặc dùng email</span>
              </div>
              <form
                className="email-otp-form"
                onSubmit={emailStep === "request" ? requestCode : verifyCode}
              >
                {!methods?.emailOtp && (
                  <p className="auth-method-unavailable">
                    {methods
                      ? "Email OTP chưa được cấu hình Resend hoặc SMTP."
                      : "Đang kiểm tra dịch vụ email…"}
                  </p>
                )}
                <fieldset disabled={!methods?.emailOtp || submitting}>
                {emailStep === "request" ? (
                  <>
                    <label>
                      <span>Tên hiển thị</span>
                      <span className="email-otp-input">
                        <ShieldCheck size={16} />
                        <input
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          minLength={2}
                          maxLength={60}
                          autoComplete="name"
                          placeholder="Tên mọi người sẽ thấy"
                          required
                        />
                      </span>
                    </label>
                    <label>
                      <span>Email</span>
                      <span className="email-otp-input">
                        <Mail size={16} />
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          maxLength={254}
                          autoComplete="email"
                          placeholder="ban@example.com"
                          required
                        />
                      </span>
                    </label>
                    <label className="auth-contact-consent">
                      <input
                        type="checkbox"
                        checked={contactPrivacyAccepted}
                        onChange={(event) =>
                          setContactPrivacyAccepted(event.target.checked)
                        }
                        required
                      />
                      <span>
                        <strong>Cam kết sử dụng thông tin liên hệ</strong>
                        <small>
                          Tôi đồng ý số điện thoại và URL Facebook chỉ được dùng
                          để thành viên trao đổi, thực hiện giao dịch và hỗ trợ an
                          toàn; không bán hoặc chia sẻ cho quảng cáo hay bên thứ
                          ba ngoài mục đích vận hành marketplace.
                        </small>
                      </span>
                    </label>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="email-otp-back"
                      onClick={() => {
                        setEmailStep("request");
                        setCode("");
                        setError("");
                        setMessage("");
                      }}
                    >
                      <ArrowLeft size={14} /> Đổi email
                    </button>
                    <label>
                      <span>Mã OTP gửi tới {email.trim().toLowerCase()}</span>
                      <span className="email-otp-input code">
                        <KeyRound size={16} />
                        <input
                          value={code}
                          onChange={(event) =>
                            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          placeholder="000000"
                          required
                          autoFocus
                        />
                      </span>
                    </label>
                  </>
                )}
                <button className="email-otp-submit" disabled={submitting}>
                  {submitting ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : emailStep === "request" ? (
                    <Mail size={17} />
                  ) : (
                    <KeyRound size={17} />
                  )}
                  {emailStep === "request" ? "Gửi mã đăng nhập" : "Xác nhận mã"}
                </button>
                </fieldset>
              </form>
              {message && <p className="email-otp-message success">{message}</p>}
              {error && <p className="email-otp-message error">{error}</p>}
              <label className="remember-login">
                <input
                  type="checkbox"
                  checked={rememberForThirtyDays}
                  onChange={(event) =>
                    setRememberForThirtyDays(event.target.checked)
                  }
                />
                <span>
                  <strong>Duy trì đăng nhập trong 30 ngày</strong>
                  <small>Chỉ nên chọn trên thiết bị cá nhân của bạn.</small>
                </span>
              </label>
              <Link href="/admin/login" className="admin-login-link">
                <LockKeyhole size={17} /> Đăng nhập dành cho admin
              </Link>
            </>
          )}
          <div className="auth-security">
            <ShieldCheck size={18} />
            <span>
              <strong>Mã OTP chỉ dùng một lần</strong>
              <small>
                Mã từ taskflow-planner hết hạn sau 10 phút. Nếu chưa thấy, hãy
                kiểm tra cả Spam/Thư rác.
              </small>
            </span>
          </div>
          <p className="auth-legal">
            Bằng việc tiếp tục, bạn đồng ý với <Link href="/terms">Điều khoản</Link>{" "}
            và <Link href="/privacy">Chính sách quyền riêng tư</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
