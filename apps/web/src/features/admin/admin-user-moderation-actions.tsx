"use client";

import { useState } from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function AdminUserReportActions({
  reportId,
  onResolved,
}: {
  reportId: string;
  onResolved: () => void;
}) {
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resolve = async (decision: "RESTRICT_POSTING" | "DISMISS") => {
    if (busy) return;
    if (decision === "RESTRICT_POSTING" && resolution.trim().length < 3) {
      setError("Nhập lý do vi phạm trước khi khóa quyền đăng.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/admin/user-reports/${reportId}/resolve`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            ...(resolution.trim() && { resolution: resolution.trim() }),
          }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        throw new Error(
          Array.isArray(body?.message)
            ? body.message.join(" ")
            : body?.message || "Không thể xử lý tố cáo.",
        );
      }
      onResolved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể xử lý tố cáo.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-moderation-actions">
      <input
        value={resolution}
        onChange={(event) => setResolution(event.target.value)}
        maxLength={500}
        placeholder="Kết luận/lý do vi phạm"
        aria-label="Kết luận xử lý tố cáo"
      />
      <div>
        <button
          className="restrict"
          disabled={busy}
          onClick={() => void resolve("RESTRICT_POSTING")}
        >
          Xác nhận vi phạm
        </button>
        <button disabled={busy} onClick={() => void resolve("DISMISS")}>
          Bỏ qua tố cáo
        </button>
      </div>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

export function RestorePostingPermissionButton({
  userId,
  onRestored,
}: {
  userId: string;
  onRestored: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/admin/users/${userId}/posting-permission`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowed: true }),
        },
      );
      if (!response.ok) throw new Error("Không thể khôi phục quyền đăng.");
      onRestored();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể khôi phục quyền đăng.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="restore-posting-action">
      <button disabled={busy} onClick={() => void restore()}>
        {busy ? "Đang xử lý…" : "Cho phép đăng lại"}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
