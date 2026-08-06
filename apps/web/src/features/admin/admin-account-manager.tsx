"use client";

import {
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type AdminAccount = {
  id: string;
  email: string;
  createdAt: string;
  createdById: string | null;
  user: {
    id: string;
    displayName: string;
    status: string;
    lastLoginAt: string | null;
  };
};

export function AdminAccountManager() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null,
  );

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/accounts`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) setAccounts((await response.json()) as AdminAccount[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/admin/accounts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const detail = Array.isArray(body?.message)
          ? body.message[0]
          : body?.message;
        setError(detail ?? "Không thể tạo tài khoản quản trị.");
        return;
      }
      setDisplayName("");
      setEmail("");
      setPassword("");
      setMessage("Đã cấp tài khoản admin mới.");
      await loadAccounts();
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeAccount(account: AdminAccount) {
    if (
      !window.confirm(
        `Thu hồi quyền admin của ${account.user.displayName} (${account.email})? Tài khoản này sẽ không thể đăng nhập lại.`,
      )
    )
      return;

    setDeletingAccountId(account.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/admin/accounts/${account.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const detail = Array.isArray(body?.message)
          ? body.message[0]
          : body?.message;
        setError(detail ?? "Không thể thu hồi tài khoản admin.");
        return;
      }
      setMessage(`Đã thu hồi quyền admin của ${account.user.displayName}.`);
      await loadAccounts();
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setDeletingAccountId(null);
    }
  }

  return (
    <section className="admin-account-panel">
      <header>
        <div>
          <span className="section-kicker">PHÂN QUYỀN</span>
          <h2>Tài khoản quản trị</h2>
          <p>Chỉ admin đang đăng nhập mới có thể cấp thêm tài khoản admin.</p>
        </div>
        <span className="admin-account-count">
          <ShieldCheck size={16} /> {accounts.length} tài khoản
        </span>
      </header>
      <div className="admin-account-layout">
        <form className="admin-account-form" onSubmit={createAccount}>
          <h3>
            <UserPlus size={17} /> Cấp tài khoản mới
          </h3>
          <label>
            <span>Tên hiển thị</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <label>
            <span>Email đăng nhập</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label>
            <span>Mật khẩu ban đầu</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <small>Ít nhất 12 ký tự, có chữ hoa, chữ thường và chữ số.</small>
          </label>
          {error && <p className="admin-form-message error">{error}</p>}
          {message && (
            <p className="admin-form-message success">
              <CheckCircle2 size={14} /> {message}
            </p>
          )}
          <button className="button button-primary" disabled={submitting}>
            {submitting ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <KeyRound size={16} />
            )}
            {submitting ? "Đang tạo…" : "Cấp tài khoản admin"}
          </button>
        </form>
        <div className="admin-account-list">
          <h3>Admin đã được cấp</h3>
          {loading ? (
            <div className="notification-empty">
              <LoaderCircle className="spin" size={17} /> Đang tải…
            </div>
          ) : (
            accounts.map((account) => (
              <article key={account.id}>
                <span className="admin-account-icon">
                  <ShieldCheck size={17} />
                </span>
                <span>
                  <strong>{account.user.displayName}</strong>
                  <small>{account.email}</small>
                </span>
                <span className="admin-account-actions">
                  {account.createdById === null ? (
                    <b className="status-badge">Seed bảo vệ</b>
                  ) : account.user.id === user?.id ? (
                    <b className="status-badge">Tài khoản hiện tại</b>
                  ) : (
                    <button
                      type="button"
                      className="admin-account-delete"
                      disabled={deletingAccountId === account.id}
                      onClick={() => void revokeAccount(account)}
                    >
                      {deletingAccountId === account.id ? (
                        <LoaderCircle className="spin" size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Thu hồi
                    </button>
                  )}
                </span>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
