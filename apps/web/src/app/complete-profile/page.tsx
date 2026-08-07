"use client";

import {
  ArrowRight,
  Facebook,
  LoaderCircle,
  LockKeyhole,
  Phone,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function safeNextPath() {
  if (typeof window === "undefined") return "/marketplace";
  const value = new URLSearchParams(window.location.search).get("next");
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    value !== "/complete-profile"
    ? value
    : "/marketplace";
}

export default function CompleteProfilePage() {
  const { user, loading, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const phoneNumber = String(formData.get("phoneNumber") ?? "");
    const facebookProfileUrl = String(formData.get("facebookProfileUrl") ?? "");
    const requestBody = {
      phoneNumber,
      facebookProfileUrl,
    };
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const message = Array.isArray(body?.message)
          ? body.message[0]
          : body?.message;
        throw new Error(
          message ?? "Không thể lưu thông tin. Vui lòng thử lại.",
        );
      }
      await refresh();
      window.location.assign(safeNextPath());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu thông tin. Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user)
    return (
      <main className="profile-setup-page">
        <div className="profile-setup-loading">
          <LoaderCircle className="spin" /> Đang chuẩn bị hồ sơ…
        </div>
      </main>
    );

  const editingExistingProfile = user.profileCompleted;

  return (
    <main className="profile-setup-page">
      <section className="profile-setup-card">
        <div className="profile-setup-heading">
          <Image
            src={user.avatarUrl ?? "/brand/admin-profile.png"}
            alt={user.displayName}
            width={72}
            height={72}
            unoptimized={Boolean(user.avatarUrl)}
          />
          <div>
            <span className="section-kicker">
              {editingExistingProfile
                ? "CẬP NHẬT HỒ SƠ LIÊN HỆ"
                : "HOÀN THIỆN TÀI KHOẢN"}
            </span>
            <h1>
              {editingExistingProfile
                ? `${user.displayName}, cập nhật thông tin của bạn.`
                : `Chào ${user.displayName}, còn một bước nữa.`}
            </h1>
            <p>
              Thông tin này giúp người mua và người bán liên hệ đúng người khi
              bắt đầu giao dịch.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="profile-setup-form">
          <label>
            <span>
              <Phone size={16} /> Số điện thoại liên hệ
            </span>
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              name="phoneNumber"
              defaultValue={user.phoneNumber ?? ""}
              placeholder="Ví dụ: 0912345678"
            />
            <small>Chấp nhận số Việt Nam bắt đầu bằng 0 hoặc +84.</small>
          </label>
          <label>
            <span>
              <Facebook size={16} /> Đường dẫn Facebook
            </span>
            <input
              required
              type="url"
              inputMode="url"
              name="facebookProfileUrl"
              defaultValue={user.facebookProfileUrl ?? ""}
              placeholder="https://www.facebook.com/ten-cua-ban"
            />
            <small>
              Google và đăng nhập email không cung cấp đường dẫn Facebook. Hãy
              dán đúng URL trang cá nhân mà bạn dùng để giao dịch.
            </small>
          </label>
          <div className="profile-contact-notice">
            <ShieldCheck size={18} />
            <span>
              <strong>Cam kết bảo vệ thông tin từ nền tảng</strong>
              <small>
                TWS Community Market cam kết bảo vệ số điện thoại và URL
                Facebook, chỉ cung cấp trong luồng liên hệ giao dịch hoặc khi
                quản trị viên hỗ trợ an toàn; không bán cho nhà quảng cáo hay
                chia sẻ ngoài mục đích vận hành và yêu cầu pháp luật hợp lệ.
              </small>
            </span>
          </div>
          {error && (
            <p className="profile-setup-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-primary profile-setup-submit"
            disabled={saving}
          >
            {saving ? (
              <>
                <LoaderCircle className="spin" size={17} /> Đang lưu…
              </>
            ) : (
              <>
                {editingExistingProfile ? "Lưu thay đổi" : "Lưu và tiếp tục"}{" "}
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        <footer>
          <LockKeyhole size={14} /> Bạn có thể cập nhật lại thông tin trong
          trang tài khoản.
        </footer>
      </section>
    </main>
  );
}
