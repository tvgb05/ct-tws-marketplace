"use client";

import { LoaderCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listing-card";
import { SellerTradeManager } from "@/features/trade/seller-trade-manager";
import type { MarketplaceListing } from "@/lib/marketplace-types";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function MyListingsPage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetch(`${apiUrl}/listings/mine`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.ok)
          setListings((await response.json()) as MarketplaceListing[]);
      })
      .finally(() => setLoading(false));
  }, []);
  return (
    <main className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">TÀI KHOẢN</span>
          <h1>Bài đăng của tôi</h1>
          <p>
            Quản lý tình trạng, người mua hiện tại và hàng chờ của từng sản
            phẩm.
          </p>
        </div>
        <Link className="button button-primary" href="/account/listings/new">
          <Plus size={17} /> Đăng sản phẩm mới
        </Link>
      </div>
      <SellerTradeManager
        onListingStatusChange={(listingId, status, inventory) =>
          setListings((current) =>
            current.map((listing) =>
              listing.id === listingId
                ? {
                    ...listing,
                    status,
                    ...(inventory && {
                      totalQuantity: inventory.totalQuantity,
                      reservedQuantity: inventory.inTransactionQuantity,
                      soldQuantity: inventory.soldQuantity,
                    }),
                  }
                : listing,
            ),
          )
        }
      />
      {loading ? (
        <div className="notification-empty">
          <LoaderCircle className="spin" /> Đang tải bài đăng…
        </div>
      ) : listings.length ? (
        <div className="listing-grid">
          {listings.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="notification-empty">Bạn chưa có bài đăng nào.</div>
      )}
    </main>
  );
}
