"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImagePlus,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { ListingCodeBadges } from "@/components/listing-code-badges";
import { formatDate, formatPrice } from "@/lib/format";
import {
  availableListingQuantity,
  deliveryLabel,
  initials,
  listingImage,
  MarketplaceListing,
} from "@/lib/marketplace-types";
import { useAuth } from "@/lib/auth";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function ListingDetail({ item }: { item: MarketplaceListing }) {
  const { user } = useAuth();
  const gallery = item.images.length
    ? item.images.map((image) => image.secureUrl)
    : [listingImage(item)];
  const [photo, setPhoto] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [modal, setModal] = useState<"contact" | "mediation" | null>(null);
  const [listingStatus, setListingStatus] = useState(item.status);
  const [inventory, setInventory] = useState({
    totalQuantity: item.totalQuantity,
    inTransactionQuantity: item.reservedQuantity,
    soldQuantity: item.soldQuantity,
    availableQuantity: availableListingQuantity(item),
  });
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [interestStatus, setInterestStatus] = useState<
    "ACTIVE" | "QUEUED" | null
  >(null);
  const [requesting, setRequesting] = useState(false);
  const [contact, setContact] = useState<{
    type: string;
    value: string;
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const ownListing = user?.id === item.seller.id;

  useEffect(() => {
    if (!user || ownListing) return;
    void fetch(`${apiUrl}/trades/mine`, {
      credentials: "include",
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) return;
      const trades = (await response.json()) as Array<{
        status: "ACTIVE" | "QUEUED" | "COMPLETED" | "CANCELLED" | "DECLINED";
        listing: { id: string };
      }>;
      const current = trades.find(
        (trade) =>
          trade.listing.id === item.id &&
          (trade.status === "ACTIVE" || trade.status === "QUEUED"),
      );
      setInterestStatus(
        current?.status === "ACTIVE" || current?.status === "QUEUED"
          ? current.status
          : null,
      );
    });
  }, [item.id, ownListing, user]);

  const toggleFavorite = async () => {
    const next = !favorite;
    const response = await fetch(`${apiUrl}/favorites/${item.id}`, {
      method: next ? "POST" : "DELETE",
      credentials: "include",
    });
    if (response.ok) setFavorite(next);
  };

  const requestContact = async () => {
    setRequesting(true);
    setFeedback("");
    try {
      const response = await fetch(`${apiUrl}/listings/${item.id}/contact`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: requestQuantity }),
      });
      const result = (await response.json()) as {
        trade?: {
          status: "ACTIVE" | "QUEUED";
          requestedQuantity: number;
          allocatedQuantity: number;
        };
        contact?: { type: string; value: string } | null;
        inventory?: typeof inventory;
        listingStatus?: MarketplaceListing["status"];
        message?: string;
      };
      if (!response.ok || !result.trade)
        throw new Error(result.message ?? "Không thể bắt đầu giao dịch.");
      setInterestStatus(result.trade.status);
      if (result.inventory) setInventory(result.inventory);
      if (result.listingStatus) setListingStatus(result.listingStatus);
      setContact(result.contact ?? null);
      setFeedback(
        result.trade.status === "QUEUED"
          ? `Đã vào hàng chờ với yêu cầu ${result.trade.requestedQuantity} sản phẩm.`
          : result.trade.allocatedQuantity < result.trade.requestedQuantity
            ? `Bạn yêu cầu ${result.trade.requestedQuantity}, hệ thống chỉ giữ được ${result.trade.allocatedQuantity} sản phẩm còn lại.`
            : `Đã giữ ${result.trade.allocatedQuantity} sản phẩm cho giao dịch của bạn.`,
      );
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Không thể bắt đầu giao dịch.",
      );
    } finally {
      setRequesting(false);
    }
  };

  const requestMediation = async () => {
    setRequesting(true);
    setFeedback("");
    try {
      const response = await fetch(
        `${apiUrl}/listings/${item.id}/mediation-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: requestQuantity }),
        },
      );
      const result = (await response.json()) as {
        message?: string;
        trade?: { status: "ACTIVE" | "QUEUED"; allocatedQuantity: number };
        inventory?: typeof inventory;
        listingStatus?: MarketplaceListing["status"];
      };
      if (!response.ok)
        throw new Error(result.message ?? "Không thể gửi yêu cầu trung gian.");
      if (result.trade) setInterestStatus(result.trade.status);
      if (result.inventory) setInventory(result.inventory);
      if (result.listingStatus) setListingStatus(result.listingStatus);
      setFeedback(
        result.trade?.status === "QUEUED"
          ? "Yêu cầu trung gian đã vào hàng chờ."
          : `Yêu cầu trung gian đã giữ ${result.trade?.allocatedQuantity ?? requestQuantity} sản phẩm.`,
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Không thể gửi yêu cầu trung gian.",
      );
    } finally {
      setRequesting(false);
    }
  };

  const joined = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(item.seller.joinedAt));
  const joiningQueue =
    modal === "contact" &&
    listingStatus === "RESERVED" &&
    interestStatus === null;
  return (
    <main className="detail-page">
      <div className="breadcrumbs">
        <Link href="/marketplace">Marketplace</Link>
        <span>/</span>
        <Link href={`/marketplace?category=${item.category.slug}`}>
          {item.category.name}
        </Link>
        <span>/</span>
        <b>{item.title}</b>
      </div>
      <section className="detail-grid">
        <div className="gallery">
          <div className="gallery-main">
            <img src={gallery[photo]} alt={item.title} />
            <span
              className={`condition ${item.condition === "NEW" ? "is-new" : ""}`}
            >
              {item.condition === "NEW" ? "Mới" : "Đã qua sử dụng"}
            </span>
            {gallery.length > 1 && (
              <>
                <button
                  className="gallery-prev"
                  onClick={() =>
                    setPhoto((photo - 1 + gallery.length) % gallery.length)
                  }
                >
                  <ChevronLeft />
                </button>
                <button
                  className="gallery-next"
                  onClick={() => setPhoto((photo + 1) % gallery.length)}
                >
                  <ChevronRight />
                </button>
              </>
            )}
          </div>
          <div className="gallery-thumbs">
            {gallery.map((src, index) => (
              <button
                className={photo === index ? "active" : ""}
                onClick={() => setPhoto(index)}
                key={src}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="detail-info">
          <div className="detail-topline">
            <span>{item.category.name}</span>
            <span
              className={`listing-state-pill ${listingStatus.toLowerCase()}`}
            >
              {listingStatus === "AVAILABLE"
                ? "Đang bán"
                : listingStatus === "RESERVED"
                  ? "Đang giao dịch"
                  : "Đã bán"}
            </span>
            <button
              onClick={() => void toggleFavorite()}
              className={favorite ? "save-detail active" : "save-detail"}
            >
              <Heart size={18} fill={favorite ? "currentColor" : "none"} />{" "}
              {favorite ? "Đã lưu" : "Lưu tin"}
            </button>
          </div>
          <h1>{item.title}</h1>
          <ListingCodeBadges
            productCode={item.productCode}
            orderCode={item.orderCode}
          />
          <div className="detail-price">{formatPrice(Number(item.price))}</div>
          <div className="inventory-summary">
            <span><small>Tổng số lượng</small><strong>{inventory.totalQuantity}</strong></span>
            <span><small>Còn có thể đặt</small><strong>{inventory.availableQuantity}</strong></span>
            <span><small>Đang giao dịch</small><strong>{inventory.inTransactionQuantity}</strong></span>
            <span><small>Đã bán</small><strong>{inventory.soldQuantity}</strong></span>
          </div>
          {item.sharedPhotoItemCount && item.sharedPhotoItemCount > 1 && (
            <div className="shared-photo-context">
              <ImagePlus size={18} />
              <span>
                <strong>Ảnh này chụp chung {item.sharedPhotoItemCount} món</strong>
                <small>Giá và trạng thái phía trên chỉ áp dụng cho “{item.title}”.</small>
              </span>
            </div>
          )}
          <div className="detail-meta">
            <span>
              <MapPin size={16} />
              {item.location}
            </span>
            <span>
              Đăng ngày {formatDate(item.publishedAt ?? item.createdAt)}
            </span>
          </div>
          <div className="seller-panel">
            <span className="avatar avatar-large">
              {item.seller.avatarUrl ? (
                <img
                  src={item.seller.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                initials(item.seller.displayName)
              )}
            </span>
            <div>
              <small>Người bán</small>
              <span className="seller-name-line">
                <Link href={`/users/${item.seller.id}`}>
                  <strong>{item.seller.displayName}</strong>
                </Link>
                <AdminBadge role={item.seller.role} />
              </span>
              <p>Tham gia marketplace từ {joined}</p>
            </div>
            <span className="facebook-badge">f</span>
          </div>
          <div className="detail-actions">
            <button
              disabled={
                ownListing ||
                listingStatus === "SOLD" ||
                Boolean(interestStatus)
              }
              className="button button-primary action-main"
              onClick={() => {
                setFeedback("");
                setModal("contact");
              }}
            >
              <MessageCircle size={18} />{" "}
              {ownListing
                ? "Bài đăng của bạn"
                : listingStatus === "SOLD"
                  ? "Sản phẩm đã bán"
                  : interestStatus === "ACTIVE"
                    ? "Bạn đang giao dịch"
                    : interestStatus === "QUEUED"
                      ? "Bạn đang trong hàng chờ"
                      : listingStatus === "RESERVED"
                        ? "Tham gia hàng chờ"
                        : "Liên hệ người bán"}
            </button>
            {!ownListing &&
              item.allowAdminMediation &&
              listingStatus !== "SOLD" && (
                <button
                  className="button button-outline"
                  onClick={() => {
                    setFeedback("");
                    setModal("mediation");
                  }}
                >
                  <ShieldCheck size={18} /> Nhờ admin hỗ trợ trung gian
                </button>
              )}
          </div>
          <div className="safety-note">
            <AlertTriangle size={17} />
            <p>
              <strong>Giao dịch an toàn</strong>
              <br />
              Kiểm tra kỹ sản phẩm và hạn chế chuyển khoản trước. Bạn có thể gửi
              yêu cầu nhờ admin hỗ trợ.
            </p>
          </div>
        </div>
      </section>
      {item.sharedPhotoItems && item.sharedPhotoItems.length > 1 && (
        <section className="shared-photo-items">
          <header>
            <span className="section-kicker">CÁC MÓN TRONG CÙNG ẢNH</span>
            <h2>Chọn đúng món bạn đang quan tâm</h2>
          </header>
          <div>
            {item.sharedPhotoItems.map((related, index) => (
              <Link
                key={related.id}
                href={`/marketplace/${related.slug}`}
                className={related.id === item.id ? "active" : ""}
              >
                <b>{index + 1}</b>
                <span>
                  <strong>{related.title}</strong>
                  <small>
                    {related.productCode ? `${related.productCode} · ` : ""}
                    {related.status === "AVAILABLE"
                      ? "Đang bán"
                      : related.status === "RESERVED"
                        ? "Đang giao dịch"
                        : related.status === "SOLD"
                          ? "Đã bán"
                          : "Đã ẩn"}
                  </small>
                </span>
                <em>{formatPrice(Number(related.price))}</em>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="description-grid">
        <article>
          <span className="section-kicker">THÔNG TIN SẢN PHẨM</span>
          <h2>Mô tả từ người bán</h2>
          <p>{item.description}</p>
          <dl>
            <div>
              <dt>Tình trạng</dt>
              <dd>{item.condition === "NEW" ? "Mới" : "Đã qua sử dụng"}</dd>
            </div>
            <div>
              <dt>Giao nhận</dt>
              <dd>
                <Truck size={15} /> {deliveryLabel(item.deliveryMethod)}
              </dd>
            </div>
            <div>
              <dt>Khu vực</dt>
              <dd>{item.location}</dd>
            </div>
          </dl>
        </article>
        <aside>
          <span className="section-kicker">QUY TẮC CỘNG ĐỒNG</span>
          <h3>Mua bán tử tế bắt đầu từ sự minh bạch.</h3>
          <ul>
            <li>Giá bán được công khai</li>
            <li>Hình ảnh đúng với sản phẩm</li>
            <li>Không spam hoặc đăng trùng</li>
            <li>Tôn trọng người mua và người bán</li>
          </ul>
          <Link href="/community-guidelines">Xem đầy đủ quy tắc →</Link>
        </aside>
      </section>
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)}>
              ×
            </button>
            <span className="modal-icon">
              {modal === "contact" ? <MessageCircle /> : <ShieldCheck />}
            </span>
            <h2>
              {modal === "contact"
                ? interestStatus === "ACTIVE"
                  ? `Đang giao dịch với ${item.seller.displayName}`
                  : interestStatus === "QUEUED"
                    ? "Bạn đang trong hàng chờ"
                    : joiningQueue
                      ? "Tham gia hàng chờ"
                      : `Liên hệ ${item.seller.displayName}`
                : "Nhờ admin hỗ trợ"}
            </h2>
            <p>
              {modal === "contact"
                ? interestStatus === "ACTIVE"
                  ? "Bạn là người mua hiện tại. Hãy liên hệ người bán để thỏa thuận giao dịch."
                  : interestStatus === "QUEUED"
                    ? "Yêu cầu của bạn đã được ghi nhận. Người bán có thể chọn bạn nếu giao dịch hiện tại không thành công."
                    : joiningQueue
                      ? `${item.seller.displayName} đang giao dịch với người mua khác. Bạn sẽ được thêm vào hàng chờ.`
                      : "Khi tiếp tục, sản phẩm sẽ chuyển sang trạng thái đang giao dịch."
                : "Yêu cầu sẽ được gửi tới người bán và admin cộng đồng."}
            </p>
            {!interestStatus && (
              <label className="trade-quantity-picker">
                <span>Số lượng muốn mua</span>
                <input
                  type="number"
                  min={1}
                  max={inventory.totalQuantity}
                  value={requestQuantity}
                  onChange={(event) =>
                    setRequestQuantity(
                      Math.max(
                        1,
                        Math.min(
                          inventory.totalQuantity,
                          Number(event.target.value) || 1,
                        ),
                      ),
                    )
                  }
                />
                <small>
                  Hiện còn {inventory.availableQuantity} sản phẩm chưa được giữ.
                  Nếu không đủ, hệ thống chỉ cấp phần còn lại; hết hàng sẽ vào queue.
                </small>
              </label>
            )}
            {feedback && <p className="profile-setup-error">{feedback}</p>}
            {contact && (
              <a
                className="button button-outline"
                href={
                  contact.type === "PHONE"
                    ? `tel:${contact.value}`
                    : contact.value
                }
                target={contact.type === "PHONE" ? undefined : "_blank"}
                rel="noopener noreferrer"
              >
                Mở thông tin liên hệ
              </a>
            )}
            {modal === "contact" && interestStatus ? (
              <button
                className="button button-primary"
                onClick={() => setModal(null)}
              >
                Đóng
              </button>
            ) : (
              <button
                disabled={requesting}
                className="button button-primary"
                onClick={() =>
                  void (modal === "contact"
                    ? requestContact()
                    : requestMediation())
                }
              >
                {requesting
                  ? "Đang xử lý…"
                  : modal === "contact"
                    ? joiningQueue
                      ? "Thêm tôi vào hàng chờ"
                      : "Bắt đầu giao dịch"
                    : "Gửi yêu cầu trung gian"}
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
