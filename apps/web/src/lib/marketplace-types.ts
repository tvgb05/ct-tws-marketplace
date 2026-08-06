export type MarketplaceListing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number | string;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  condition: "NEW" | "USED";
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "HIDDEN";
  moderationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  location: string;
  deliveryMethod: "MEETUP" | "SHIPPING" | "BOTH";
  subcategory: string | null;
  allowAdminMediation: boolean;
  sharedPhotoGroupId: string | null;
  sharedPhotoItemCount: number | null;
  productCode: string | null;
  orderCode: string | null;
  sharedPhotoItems?: Array<{
    id: string;
    slug: string;
    title: string;
    price: number | string;
    status: "AVAILABLE" | "RESERVED" | "SOLD" | "HIDDEN";
    productCode: string | null;
    orderCode: string | null;
  }>;
  publishedAt: string | null;
  createdAt: string;
  seller: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    joinedAt: string;
    role: "USER" | "ADMIN";
  };
  category: { id: string; name: string; slug: string };
  images: Array<{ id: string; secureUrl: string; sortOrder: number }>;
  _count: { favorites: number; reports: number };
};

export const listingImage = (listing: MarketplaceListing) =>
  listing.images[0]?.secureUrl ?? "/brand/earbuds-hero.png";
export const availableListingQuantity = (listing: MarketplaceListing) =>
  Math.max(
    0,
    listing.totalQuantity - listing.reservedQuantity - listing.soldQuantity,
  );
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
export const deliveryLabel = (method: MarketplaceListing["deliveryMethod"]) =>
  method === "BOTH"
    ? "Gặp trực tiếp hoặc giao hàng"
    : method === "SHIPPING"
      ? "Giao hàng"
      : "Gặp trực tiếp";
export const relativeListingTime = (value: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 1) return "Vừa đăng";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return days < 30
    ? `${days} ngày trước`
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value));
};
