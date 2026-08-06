"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listing-card";
import type { MarketplaceListing } from "@/lib/marketplace-types";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function FavoritesPage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetch(`${apiUrl}/favorites`, {
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
          <span className="section-kicker">BỘ SƯU TẬP</span>
          <h1>Sản phẩm đã lưu</h1>
          <p>Danh sách này chỉ gồm những bài đăng bạn đã lưu.</p>
        </div>
      </div>
      {loading ? (
        <div className="notification-empty">
          <LoaderCircle className="spin" /> Đang tải sản phẩm…
        </div>
      ) : listings.length ? (
        <div className="listing-grid">
          {listings.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              initiallyFavorite
              onFavoriteRemoved={(id) =>
                setListings((current) =>
                  current.filter((item) => item.id !== id),
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="notification-empty">Bạn chưa lưu sản phẩm nào.</div>
      )}
    </main>
  );
}
