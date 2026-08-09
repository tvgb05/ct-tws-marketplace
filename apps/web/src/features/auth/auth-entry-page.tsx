"use client";

import {
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

type AuthIntent = "login" | "register";

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

function destinationWithNext(path: string, nextPath: string) {
  return nextPath === "/marketplace"
    ? path
    : `${path}?next=${encodeURIComponent(nextPath)}`;
}

export function AuthEntryPage({ intent }: { intent: AuthIntent }) {
  const { user, loading } = useAuth();
  const registering = intent === "register";
  const [rememberForThirtyDays, setRememberForThirtyDays] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<
    "details" | "verify"
  >("details");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [methods, setMethods] = useState<{
    google: boolean;
    emailOtp: boolean;
    emailPassword: boolean;
  } | null>(null);
  const router = useRouter();
  const requestedPath =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("next");
  const nextPath =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
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
    const authError = new URLSearchParams(window.location.search).get(
      "authError",
    );
    if (authError) {
      // The message comes from a same-origin OAuth callback.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(authError);
    }
    void fetch(`${apiUrl}/auth/methods`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setMethods(
          (await response.json()) as {
            google: boolean;
            emailOtp: boolean;
            emailPassword: boolean;
          },
        );
      })
      .catch(() =>
        setMethods({ google: false, emailOtp: false, emailPassword: false }),
      );
  }, []);

  function assertMatchingPasswords() {
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return false;
    }
    return true;
  }

  async function loginWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/email/login`, {
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
        profileCompleted?: boolean;
      } | null;
      if (!response.ok)
        throw new Error(
          apiErrorMessage(body, "Email hoặc mật khẩu không chính xác."),
        );
      window.location.assign(
        body && "profileCompleted" in body && body.profileCompleted === false
          ? `/complete-profile?next=${encodeURIComponent(nextPath)}`
          : nextPath,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể đăng nhập.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function requestRegistrationCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!assertMatchingPasswords()) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/auth/email/request-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, intent: "register" }),
      });
      const body = (await response.json().catch(() => null)) as {
        devCode?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          apiErrorMessage(body, "Không thể gửi mã. Vui lòng thử lại."),
        );
      setRegistrationStep("verify");
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

  async function completeRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/email/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          displayName,
          password,
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
        `/complete-profile?next=${encodeURIComponent(nextPath)}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tạo tài khoản.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const loginHref = destinationWithNext("/login", nextPath);
  const registerHref = destinationWithNext("/register", nextPath);
  const forgotPasswordHref = destinationWithNext("/forgot-password", nextPath);

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
          <nav className="auth-mode-tabs" aria-label="Chọn hình thức xác thực">
            <Link
              href={loginHref}
              className={!registering ? "active" : ""}
              aria-current={!registering ? "page" : undefined}
            >
              Đăng nhập
            </Link>
            <Link
              href={registerHref}
              className={registering ? "active" : ""}
              aria-current={registering ? "page" : undefined}
            >
              Tạo tài khoản
            </Link>
          </nav>
          <span className="auth-kicker">
            {registering ? "THÀNH VIÊN MỚI" : "MỪNG BẠN TRỞ LẠI"}
          </span>
          <h1>
            {registering ? "Tham gia cộng đồng" : "Đăng nhập để"}
            <br />
            <em>{registering ? "mua bán tử tế." : "tiếp tục giao dịch."}</em>
          </h1>
          <p>
            {registering
              ? "Tạo tài khoản bằng Google hoặc email, sau đó xác minh email bằng mã OTP."
              : "Đăng nhập bằng Google hoặc email và mật khẩu đã đăng ký."}
          </p>
          {loading ? (
            <div className="auth-loading">
              <LoaderCircle className="spin" /> Đang kiểm tra phiên đăng nhập…
            </div>
          ) : (
            <>
              {methods?.google ? (
                <a
                  href={`${apiOrigin}/api/v1/auth/google/start?remember=${rememberForThirtyDays ? "1" : "0"}&intent=${intent}`}
                  className="google-login-button"
                >
                  <span aria-hidden="true">G</span>{" "}
                  {registering
                    ? "Đăng ký bằng Google"
                    : "Đăng nhập bằng Google"}
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

              {registering ? (
                <form
                  className="email-otp-form"
                  onSubmit={
                    registrationStep === "details"
                      ? requestRegistrationCode
                      : completeRegistration
                  }
                >
                  {!methods?.emailOtp && (
                    <p className="auth-method-unavailable">
                      {methods
                        ? "Xác minh email chưa được cấu hình Resend hoặc SMTP."
                        : "Đang kiểm tra dịch vụ email…"}
                    </p>
                  )}
                  <fieldset disabled={!methods?.emailOtp || submitting}>
                    {registrationStep === "details" ? (
                      <>
                        <AuthInput
                          label="Tên hiển thị"
                          icon={<UserRound size={16} />}
                          value={displayName}
                          onChange={setDisplayName}
                          autoComplete="name"
                          minLength={2}
                          maxLength={60}
                          placeholder="Tên mọi người sẽ thấy"
                        />
                        <EmailInput value={email} onChange={setEmail} />
                        <PasswordInput
                          label="Mật khẩu"
                          value={password}
                          onChange={setPassword}
                          autoComplete="new-password"
                          requireLettersAndNumbers
                        />
                        <PasswordInput
                          label="Xác nhận mật khẩu"
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          autoComplete="new-password"
                          requireLettersAndNumbers
                        />
                        <small className="auth-password-requirement">
                          Ít nhất 6 ký tự, gồm ít nhất một chữ cái và một chữ
                          số.
                        </small>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="email-otp-back"
                          onClick={() => {
                            setRegistrationStep("details");
                            setCode("");
                            setError("");
                            setMessage("");
                          }}
                        >
                          <ArrowLeft size={14} /> Sửa thông tin
                        </button>
                        <label>
                          <span>
                            Mã OTP gửi tới {email.trim().toLowerCase()}
                          </span>
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
                    <SubmitButton submitting={submitting}>
                      {registrationStep === "details"
                        ? "Gửi mã xác minh"
                        : "Xác nhận và tạo tài khoản"}
                    </SubmitButton>
                  </fieldset>
                </form>
              ) : (
                <form className="email-otp-form" onSubmit={loginWithPassword}>
                  <fieldset disabled={!methods?.emailPassword || submitting}>
                    <EmailInput value={email} onChange={setEmail} />
                    <PasswordInput
                      label="Mật khẩu"
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                      minLength={6}
                    />
                    <Link
                      className="auth-forgot-password"
                      href={forgotPasswordHref}
                    >
                      Quên mật khẩu?
                    </Link>
                    <SubmitButton submitting={submitting}>
                      Đăng nhập
                    </SubmitButton>
                  </fieldset>
                </form>
              )}

              {message && (
                <p className="email-otp-message success">{message}</p>
              )}
              {error && (
                <p className="email-otp-message error" role="alert">
                  {error}
                </p>
              )}
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
          )}
          <div className="auth-security">
            <ShieldCheck size={18} />
            <span>
              <strong>Mật khẩu được bảo vệ</strong>
              <small>
                Mật khẩu được băm trước khi lưu. OTP chỉ dùng để xác minh đăng
                ký hoặc đặt lại mật khẩu và hết hạn sau 10 phút.
              </small>
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

function EmailInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <AuthInput
      label="Email"
      icon={<Mail size={16} />}
      value={value}
      onChange={onChange}
      type="email"
      autoComplete="email"
      maxLength={254}
      placeholder="ban@example.com"
    />
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  minLength = 6,
  requireLettersAndNumbers = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  requireLettersAndNumbers?: boolean;
}) {
  return (
    <AuthInput
      label={label}
      icon={<LockKeyhole size={16} />}
      value={value}
      onChange={onChange}
      type="password"
      autoComplete={autoComplete}
      minLength={minLength}
      maxLength={128}
      pattern={
        requireLettersAndNumbers
          ? "(?=.*[A-Za-z])(?=.*[0-9]).{6,128}"
          : undefined
      }
      placeholder="••••••••••••"
    />
  );
}

function AuthInput({
  label,
  icon,
  value,
  onChange,
  type = "text",
  ...inputProps
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
} & Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  "autoComplete" | "minLength" | "maxLength" | "pattern" | "placeholder"
>) {
  return (
    <label>
      <span>{label}</span>
      <span className="email-otp-input">
        {icon}
        <input
          {...inputProps}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
      </span>
    </label>
  );
}

function SubmitButton({
  submitting,
  children,
}: {
  submitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <button className="email-otp-submit" disabled={submitting}>
      {submitting ? (
        <LoaderCircle className="spin" size={17} />
      ) : (
        <KeyRound size={17} />
      )}
      {children}
    </button>
  );
}
