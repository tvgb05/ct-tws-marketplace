"use client";

import { Facebook, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1$/, "") ??
  "http://localhost:4000";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const [rememberForThirtyDays, setRememberForThirtyDays] = useState(false);
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
            Đăng nhập bằng tài khoản Facebook bạn đang sử dụng trong cộng đồng
            để tiếp tục.
          </p>
          {loading ? (
            <div className="auth-loading">
              <LoaderCircle className="spin" /> Đang kiểm tra phiên đăng nhập…
            </div>
          ) : (
            <>
              <a
                href={`${apiUrl}/api/v1/auth/facebook/start?remember=${rememberForThirtyDays ? "1" : "0"}`}
                className="facebook-button"
              >
                <Facebook fill="currentColor" /> Tiếp tục với Facebook
              </a>
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
              <div className="auth-divider">
                <span>hoặc</span>
              </div>
              <Link href="/admin/login" className="admin-login-link">
                <LockKeyhole size={17} /> Đăng nhập bằng email / Admin
              </Link>
            </>
          )}
          <div className="auth-security">
            <ShieldCheck size={18} />
            <span>
              <strong>Thông tin của bạn được bảo vệ</strong>
              <small>
                Chúng tôi chỉ sử dụng tên và ảnh đại diện công khai từ Facebook.
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
