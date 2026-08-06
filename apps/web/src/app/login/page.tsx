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
  if (!body || typeof body !== "object" || !("message" in body))
    return fallback;
  const message = (body as { message?: string | string[] }).message;
  return Array.isArray(message)
    ? (message[0] ?? fallback)
    : (message ?? fallback);
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const [loginMode, setLoginMode] = useState<"member" | "admin">("member");
  const [rememberForThirtyDays, setRememberForThirtyDays] = useState(false);
  const [emailStep, setEmailStep] = useState<"request" | "verify">("request");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
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
    if (new URLSearchParams(window.location.search).get("mode") === "admin") {
      // Preserve old /admin/login bookmarks while keeping one login page.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoginMode("admin");
    }
  }, []);

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
        caught instanceof Error ? caught.message : "Không thể xác nhận mã OTP.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function loginWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/auth/admin/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          remember: rememberForThirtyDays,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        role?: "USER" | "ADMIN";
      } | null;
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Bạn đã thử quá nhiều lần. Vui lòng đợi một phút rồi thử lại."
            : apiErrorMessage(body, "Email hoặc mật khẩu không chính xác."),
        );
      }
      window.location.assign(body?.role === "ADMIN" ? "/admin" : nextPath);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể kết nối máy chủ. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(mode: "member" | "admin") {
    setLoginMode(mode);
    const url = new URL(window.location.href);
    if (mode === "admin") url.searchParams.set("mode", "admin");
    else url.searchParams.delete("mode");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    setEmailStep("request");
    setCode("");
    setPassword("");
    setMessage("");
    setError("");
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
            {loginMode === "member"
              ? "Đăng nhập nhanh bằng Google hoặc nhận mã xác nhận qua email. Chúng tôi không yêu cầu mật khẩu email của bạn."
              : "Admin và tài khoản demo nội bộ đăng nhập bằng email cùng mật khẩu được cấp."}
          </p>
          <div
            className="auth-mode-switch"
            role="tablist"
            aria-label="Loại tài khoản"
          >
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === "member"}
              className={loginMode === "member" ? "active" : ""}
              onClick={() => changeMode("member")}
            >
              <Mail size={16} /> Thành viên
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === "admin"}
              className={loginMode === "admin" ? "active" : ""}
              onClick={() => changeMode("admin")}
            >
              <LockKeyhole size={16} /> Admin
            </button>
          </div>
          {loading ? (
            <div className="auth-loading">
              <LoaderCircle className="spin" /> Đang kiểm tra phiên đăng nhập…
            </div>
          ) : loginMode === "member" ? (
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
                            onChange={(event) =>
                              setDisplayName(event.target.value)
                            }
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
                          <strong>Cam kết bảo vệ thông tin từ nền tảng</strong>
                          <small>
                            TWS Community Market cam kết bảo vệ số điện thoại và
                            URL Facebook, chỉ cung cấp trong luồng liên hệ giao
                            dịch hoặc hỗ trợ an toàn; không bán cho nhà quảng
                            cáo hay chia sẻ ngoài mục đích vận hành và yêu cầu
                            pháp luật hợp lệ. Tôi xác nhận đã đọc cam kết này.
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
                              setCode(
                                event.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 6),
                              )
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
                    {emailStep === "request"
                      ? "Gửi mã đăng nhập"
                      : "Xác nhận mã"}
                  </button>
                </fieldset>
              </form>
              {message && (
                <p className="email-otp-message success">{message}</p>
              )}
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
            </>
          ) : (
            <form
              className="admin-login-form unified-admin-login"
              onSubmit={loginWithPassword}
            >
              <label className="admin-form-field">
                <span>Email đăng nhập</span>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  placeholder="admin@example.com"
                  required
                />
              </label>
              <label className="admin-form-field">
                <span>Mật khẩu</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <label className="remember-login admin-remember-login">
                <input
                  type="checkbox"
                  checked={rememberForThirtyDays}
                  onChange={(event) =>
                    setRememberForThirtyDays(event.target.checked)
                  }
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
                disabled={submitting}
              >
                {submitting ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <LockKeyhole size={18} />
                )}
                {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
              </button>
            </form>
          )}
          <div className="auth-security">
            <ShieldCheck size={18} />
            <span>
              <strong>
                {loginMode === "member"
                  ? "Mã OTP chỉ dùng một lần"
                  : "Phiên quản trị được bảo vệ"}
              </strong>
              {loginMode === "member" ? (
                <small>
                  Mã từ taskflow-planner hết hạn sau 10 phút. Nếu chưa thấy, hãy
                  kiểm tra cả Spam/Thư rác.
                </small>
              ) : (
                <small>
                  Mật khẩu được băm và phiên nằm trong cookie HTTP-only.
                </small>
              )}
            </span>
          </div>
          <p className="auth-legal">
            Bằng việc tiếp tục, bạn đồng ý với{" "}
            <Link href="/terms">Điều khoản</Link> và{" "}
            <Link href="/privacy">Chính sách quyền riêng tư</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
