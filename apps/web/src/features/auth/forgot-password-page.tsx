"use client";

import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

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

export function ForgotPasswordPage() {
  const [step, setStep] = useState<"details" | "verify" | "done">("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [emailOtpAvailable, setEmailOtpAvailable] = useState<boolean | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const requestedPath =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("next");
  const nextPath =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/marketplace";
  const loginHref =
    nextPath === "/marketplace"
      ? "/login"
      : `/login?next=${encodeURIComponent(nextPath)}`;

  useEffect(() => {
    void fetch(`${apiUrl}/auth/methods`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const body = (await response.json()) as { emailOtp: boolean };
        setEmailOtpAvailable(body.emailOtp);
      })
      .catch(() => setEmailOtpAvailable(false));
  }, []);

  function passwordsMatch() {
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return false;
    }
    return true;
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!passwordsMatch()) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/auth/email/request-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, intent: "reset-password" }),
      });
      const body = (await response.json().catch(() => null)) as {
        devCode?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          apiErrorMessage(body, "Không thể gửi mã. Vui lòng thử lại."),
        );
      setStep("verify");
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

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/email/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(apiErrorMessage(body, "Không thể đặt lại mật khẩu."));
      setMessage("");
      setStep("done");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể đặt lại mật khẩu.",
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
            Xác minh email giúp bạn lấy lại quyền truy cập mà không cần liên hệ
            quản trị viên.
          </p>
          <small>TWS Community Market</small>
        </div>
      </div>
      <div className="auth-form">
        <div className="auth-box forgot-password-box">
          <Link className="email-otp-back" href={loginHref}>
            <ArrowLeft size={14} /> Trở lại đăng nhập
          </Link>
          <span className="auth-kicker">KHÔI PHỤC TÀI KHOẢN</span>
          <h1>
            Đặt lại
            <br />
            <em>mật khẩu.</em>
          </h1>
          <p>
            Nhận mã OTP qua email, sau đó tạo mật khẩu mới cho tài khoản của
            bạn.
          </p>

          {step === "done" ? (
            <div className="password-reset-success">
              <CheckCircle2 size={34} />
              <h2>Đã đổi mật khẩu</h2>
              <p>Tất cả phiên đăng nhập cũ đã hết hiệu lực.</p>
              <Link className="button button-primary" href={loginHref}>
                Đăng nhập bằng mật khẩu mới
              </Link>
            </div>
          ) : (
            <form
              className="email-otp-form forgot-password-form"
              onSubmit={step === "details" ? requestCode : resetPassword}
            >
              {emailOtpAvailable === false && (
                <p className="auth-method-unavailable">
                  Dịch vụ gửi OTP chưa được cấu hình Resend hoặc SMTP.
                </p>
              )}
              <fieldset disabled={!emailOtpAvailable || submitting}>
                {step === "details" ? (
                  <>
                    <label>
                      <span>Email tài khoản</span>
                      <span className="email-otp-input">
                        <Mail size={16} />
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          autoComplete="email"
                          maxLength={254}
                          placeholder="ban@example.com"
                          required
                        />
                      </span>
                    </label>
                    <PasswordField
                      label="Mật khẩu mới"
                      value={password}
                      onChange={setPassword}
                    />
                    <PasswordField
                      label="Xác nhận mật khẩu mới"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                    />
                    <small className="auth-password-requirement">
                      Ít nhất 6 ký tự, gồm ít nhất một chữ cái và một chữ số.
                    </small>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="email-otp-back"
                      onClick={() => {
                        setStep("details");
                        setCode("");
                        setError("");
                        setMessage("");
                      }}
                    >
                      <ArrowLeft size={14} /> Sửa email hoặc mật khẩu
                    </button>
                    <label>
                      <span>Mã OTP gửi tới {email.trim().toLowerCase()}</span>
                      <span className="email-otp-input code">
                        <KeyRound size={16} />
                        <input
                          value={code}
                          onChange={(event) =>
                            setCode(
                              event.target.value.replace(/\D/g, "").slice(0, 6),
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
                  ) : step === "details" ? (
                    <Mail size={17} />
                  ) : (
                    <ShieldCheck size={17} />
                  )}
                  {step === "details"
                    ? "Gửi mã đặt lại mật khẩu"
                    : "Xác nhận mật khẩu mới"}
                </button>
              </fieldset>
            </form>
          )}
          {message && <p className="email-otp-message success">{message}</p>}
          {error && (
            <p className="email-otp-message error" role="alert">
              {error}
            </p>
          )}
          {step !== "done" && (
            <div className="auth-security">
              <ShieldCheck size={18} />
              <span>
                <strong>Mã chỉ dùng một lần</strong>
                <small>
                  OTP hết hạn sau 10 phút. Sau khi đổi mật khẩu, các phiên cũ sẽ
                  bị đăng xuất.
                </small>
              </span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <span className="email-otp-input">
        <LockKeyhole size={16} />
        <input
          type="password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          minLength={6}
          maxLength={128}
          pattern="(?=.*[A-Za-z])(?=.*[0-9]).{6,128}"
          placeholder="••••••••••••"
          required
        />
      </span>
    </label>
  );
}
