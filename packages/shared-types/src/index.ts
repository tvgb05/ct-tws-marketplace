export type ListingCondition = "NEW" | "USED";
export type DeliveryMethod = "MEETUP" | "SHIPPING" | "BOTH";
export type ListingStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "HIDDEN";

export interface SellerSummary {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: string;
}

export interface ListingSummary {
  id: string;
  slug: string;
  title: string;
  price: number;
  condition: ListingCondition;
  location: string;
  imageUrl: string;
  status: ListingStatus;
  isFavorite?: boolean;
  seller: SellerSummary;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

