"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import { useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { ListingCodeBadges } from "@/components/listing-code-badges";
import { formatPrice } from "@/lib/format";
import {
  availableListingQuantity,
  initials,
  listingImage,
  MarketplaceListing,
  relativeListingTime,
} from "@/lib/marketplace-types";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function ListingCard({
  item,
  orderItems = [item],
  initiallyFavorite = false,
  onFavoriteRemoved,
}: {
  item: MarketplaceListing;
  orderItems?: MarketplaceListing[];
  initiallyFavorite?: boolean;
  onFavoriteRemoved?: (id: string) => void;
}) {
  const isOrderGroup = orderItems.length > 1;
  const prices = orderItems.map((listing) => Number(listing.price));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const availableQuantity = orderItems.reduce(
    (total, listing) => total + availableListingQuantity(listing),
    0,
  );
  const reservedQuantity = orderItems.reduce(
    (total, listing) => total + listing.reservedQuantity,
    0,
  );
  const allSold = orderItems.every((listing) => listing.status === "SOLD");
  const groupStatus = allSold
    ? "SOLD"
    : orderItems.some((listing) => listing.status === "AVAILABLE")
      ? "AVAILABLE"
      : orderItems.some((listing) => listing.status === "RESERVED")
        ? "RESERVED"
        : item.status;
  const categoryNames = Array.from(
    new Set(orderItems.map((listing) => listing.category.name)),
  );
  const [favorite, setFavorite] = useState(initiallyFavorite);
  const [updating, setUpdating] = useState(false);
  const toggleFavorite = async () => {
    if (updating) return;
    setUpdating(true);
    const next = !favorite;
    try {
      const response = await fetch(`${apiUrl}/favorites/${item.id}`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setFavorite(next);
        if (!next) onFavoriteRemoved?.(item.id);
      }
    } finally {
      setUpdating(false);
    }
  };

  return (
    <article
      className={
        groupStatus === "SOLD" ? "listing-card is-sold" : "listing-card"
      }
    >
      <Link className="card-image" href={`/marketplace/${item.slug}`}>
        <img src={listingImage(item)} alt={item.title} />
        {(isOrderGroup ||
          (item.sharedPhotoItemCount && item.sharedPhotoItemCount > 1)) && (
          <span className="shared-photo-badge">
            Đơn chung ·{" "}
            {isOrderGroup ? orderItems.length : item.sharedPhotoItemCount} sản
            phẩm
          </span>
        )}
        {!isOrderGroup && (
          <span
            className={`condition ${item.condition === "NEW" ? "is-new" : ""}`}
          >
            {item.condition === "NEW" ? "Mới" : "Đã dùng"}
          </span>
        )}
        {groupStatus !== "AVAILABLE" && (
          <span className={`trade-status-card ${groupStatus.toLowerCase()}`}>
            {groupStatus === "RESERVED"
              ? "Đang giao dịch"
              : groupStatus === "SOLD"
                ? "Đã bán"
                : "Đã ẩn"}
          </span>
        )}
      </Link>
      {!isOrderGroup && (
        <button
          disabled={updating}
          className={favorite ? "heart-button active" : "heart-button"}
          onClick={() => void toggleFavorite()}
          aria-label={favorite ? "Bỏ lưu bài đăng" : "Lưu bài đăng"}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
      )}
      <div className="card-content">
        <div className="card-category">
          {categoryNames.length === 1
            ? categoryNames[0]
            : `${categoryNames.length} danh mục`}
        </div>
        <ListingCodeBadges
          productCode={isOrderGroup ? null : item.productCode}
          orderCode={item.orderCode}
          compact
        />
        <Link href={`/marketplace/${item.slug}`}>
          <h3>
            {isOrderGroup
              ? `Đơn gồm ${orderItems.length} sản phẩm`
              : item.title}
          </h3>
        </Link>
        {isOrderGroup && (
          <ul className="card-order-items">
            {orderItems.slice(0, 3).map((listing) => (
              <li key={listing.id}>{listing.title}</li>
            ))}
          </ul>
        )}
        <strong className="card-price">
          {minPrice === maxPrice
            ? formatPrice(minPrice)
            : `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`}
        </strong>
        <div className="card-inventory">
          <span>Còn {availableQuantity}</span>
          {reservedQuantity > 0 && (
            <small>{reservedQuantity} đang giao dịch</small>
          )}
        </div>
        <div className="card-location">
          <MapPin size={14} /> {item.location}
        </div>
        <div className="card-seller">
          <span className="avatar avatar-xs">
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
          <Link
            className="seller-profile-name"
            href={`/users/${item.seller.id}`}
          >
            {item.seller.displayName}
          </Link>
          <AdminBadge role={item.seller.role} />
          <i>·</i>
          <time dateTime={item.createdAt}>
            {relativeListingTime(item.createdAt)}
          </time>
        </div>
      </div>
    </article>
  );
}
