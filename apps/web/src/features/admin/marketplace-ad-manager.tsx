"use client";

/* eslint-disable @next/next/no-img-element */

import { ExternalLink, ImageIcon, LoaderCircle, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Placement = "MARKETPLACE_LEFT" | "MARKETPLACE_RIGHT";
type AdDraft = {
  placement: Placement;
  enabled: boolean;
  title: string;
  sponsorName: string;
  description: string;
  imageUrl: string;
  targetUrl: string;
};

const initialAds: Record<Placement, AdDraft> = {
  MARKETPLACE_LEFT: {
    placement: "MARKETPLACE_LEFT",
    enabled: false,
    title: "",
    sponsorName: "",
    description: "",
    imageUrl: "",
    targetUrl: "",
  },
  MARKETPLACE_RIGHT: {
    placement: "MARKETPLACE_RIGHT",
    enabled: false,
    title: "",
    sponsorName: "",
    description: "",
    imageUrl: "",
    targetUrl: "",
  },
};

const placements: Placement[] = ["MARKETPLACE_LEFT", "MARKETPLACE_RIGHT"];

export function MarketplaceAdManager() {
  const [ads, setAds] = useState(initialAds);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Placement | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`${apiUrl}/admin/marketplace-ads`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const records = (await response.json()) as Array<
          Omit<
            AdDraft,
            "sponsorName" | "description" | "imageUrl" | "targetUrl"
          > & {
            sponsorName: string | null;
            description: string | null;
            imageUrl: string | null;
            targetUrl: string | null;
          }
        >;
        setAds((current) => {
          const next = { ...current };
          for (const record of records)
            next[record.placement] = {
              ...record,
              sponsorName: record.sponsorName ?? "",
              description: record.description ?? "",
              imageUrl: record.imageUrl ?? "",
              targetUrl: record.targetUrl ?? "",
            };
          return next;
        });
      })
      .catch(() => setError("Không thể tải cấu hình quảng cáo."))
      .finally(() => setLoading(false));
  }, []);

  function updateAd<K extends keyof AdDraft>(
    placement: Placement,
    key: K,
    value: AdDraft[K],
  ) {
    setAds((current) => ({
      ...current,
      [placement]: { ...current[placement], [key]: value },
    }));
  }

  async function saveAd(placement: Placement) {
    setSaving(placement);
    setError("");
    setMessage("");
    try {
      const draft = ads[placement];
      const response = await fetch(
        `${apiUrl}/admin/marketplace-ads/${placement}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: draft.enabled,
            title: draft.title,
            sponsorName: draft.sponsorName,
            description: draft.description,
            imageUrl: draft.imageUrl,
            targetUrl: draft.targetUrl,
          }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const detail = Array.isArray(body?.message)
          ? body.message[0]
          : body?.message;
        throw new Error(detail ?? "Không thể lưu vị trí quảng cáo.");
      }
      setMessage(
        `Đã lưu quảng cáo bên ${placement === "MARKETPLACE_LEFT" ? "trái" : "phải"}.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu vị trí quảng cáo.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="admin-ad-panel">
      <header>
        <div>
          <span className="section-kicker">HIỂN THỊ QUẢNG CÁO</span>
          <h2>Hai vị trí bên marketplace</h2>
          <p>
            Chỉ quảng cáo được admin bật mới hiển thị, và chỉ xuất hiện khi màn
            hình đủ rộng để không che nội dung.
          </p>
        </div>
        <Megaphone size={22} />
      </header>
      {loading ? (
        <div className="notification-empty">
          <LoaderCircle className="spin" /> Đang tải cấu hình…
        </div>
      ) : (
        <div className="admin-ad-grid">
          {placements.map((placement) => {
            const ad = ads[placement];
            return (
              <article key={placement}>
                <div className="admin-ad-form">
                  <div className="admin-ad-title">
                    <h3>
                      Vị trí bên{" "}
                      {placement === "MARKETPLACE_LEFT" ? "trái" : "phải"}
                    </h3>
                    <label className="admin-ad-switch">
                      <input
                        type="checkbox"
                        checked={ad.enabled}
                        onChange={(event) =>
                          updateAd(placement, "enabled", event.target.checked)
                        }
                      />
                      <span>{ad.enabled ? "Đang hiển thị" : "Đang tắt"}</span>
                    </label>
                  </div>
                  <label>
                    <span>Nhà tài trợ / thương hiệu</span>
                    <input
                      value={ad.sponsorName}
                      maxLength={80}
                      onChange={(event) =>
                        updateAd(placement, "sponsorName", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Tiêu đề</span>
                    <input
                      value={ad.title}
                      maxLength={80}
                      required={ad.enabled}
                      onChange={(event) =>
                        updateAd(placement, "title", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Mô tả ngắn</span>
                    <textarea
                      value={ad.description}
                      maxLength={220}
                      rows={3}
                      onChange={(event) =>
                        updateAd(placement, "description", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>URL hình ảnh HTTPS</span>
                    <input
                      type="url"
                      value={ad.imageUrl}
                      placeholder="https://res.cloudinary.com/..."
                      onChange={(event) =>
                        updateAd(placement, "imageUrl", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Liên kết khi bấm</span>
                    <input
                      type="url"
                      value={ad.targetUrl}
                      required={ad.enabled}
                      placeholder="https://..."
                      onChange={(event) =>
                        updateAd(placement, "targetUrl", event.target.value)
                      }
                    />
                  </label>
                  <button
                    className="button button-primary"
                    disabled={saving !== null}
                    onClick={() => void saveAd(placement)}
                  >
                    {saving === placement ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : (
                      <Megaphone size={15} />
                    )}
                    Lưu vị trí
                  </button>
                </div>
                <div className="admin-ad-preview">
                  <span>XEM TRƯỚC</span>
                  {ad.imageUrl ? (
                    <img src={ad.imageUrl} alt="" />
                  ) : (
                    <div>
                      <ImageIcon />
                      <small>Chưa có hình ảnh</small>
                    </div>
                  )}
                  <strong>{ad.title || "Tiêu đề quảng cáo"}</strong>
                  {ad.targetUrl && (
                    <a href={ad.targetUrl} target="_blank" rel="noreferrer">
                      Kiểm tra liên kết <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {error && <p className="admin-form-message error">{error}</p>}
      {message && <p className="admin-form-message success">{message}</p>}
    </section>
  );
}
