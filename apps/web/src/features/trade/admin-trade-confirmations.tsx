"use client";

import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { ListingCodeBadges } from "@/components/listing-code-badges";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type Trade = {
  id: string;
  status: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  mediationRequest: {
    id: string;
    assignedAdminId: string | null;
  } | null;
  buyer: { id: string; displayName: string; role: "USER" | "ADMIN" };
  seller: { id: string; displayName: string; role: "USER" | "ADMIN" };
  listing: {
    title: string;
    productCode: string | null;
    orderCode: string | null;
  };
};

export function AdminTradeConfirmations() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/trades/mine`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) setTrades((await response.json()) as Trade[]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const pending = useMemo(
    () =>
      trades.filter(
        (trade) => trade.status === "ACTIVE" && Boolean(trade.mediationRequest),
      ),
    [trades],
  );
  const confirm = async (tradeId: string) => {
    setUpdating(tradeId);
    try {
      const response = await fetch(
        `${apiUrl}/trades/${tradeId}/admin-complete`,
        { method: "POST", credentials: "include" },
      );
      if (response.ok) await load();
    } finally {
      setUpdating(null);
    }
  };
  if (loading)
    return (
      <div className="trade-manager-loading">
        <LoaderCircle className="spin" size={18} /> Đang tải giao dịch trung
        gian…
      </div>
    );
  if (pending.length === 0) return null;
  return (
    <section className="admin-trade-confirmations">
      <div className="trade-manager-heading">
        <div>
          <span className="section-kicker">GIAO DỊCH TRUNG GIAN</span>
          <h2>Chờ admin xác nhận</h2>
        </div>
        <span>
          <ShieldCheck size={16} /> {pending.length} giao dịch
        </span>
      </div>
      <div className="admin-confirm-list">
        {pending.map((trade) => (
          <article key={trade.id}>
            <div>
              <small>SẢN PHẨM</small>
              <strong>{trade.listing.title}</strong>
              <ListingCodeBadges
                productCode={trade.listing.productCode}
                orderCode={trade.listing.orderCode}
                compact
              />
            </div>
            <p>
              <Link href={`/users/${trade.buyer.id}`}>
                <b>{trade.buyer.displayName}</b>
              </Link>
              <AdminBadge role={trade.buyer.role} /> mua từ{" "}
              <Link href={`/users/${trade.seller.id}`}>
                <b>{trade.seller.displayName}</b>
              </Link>
              <AdminBadge role={trade.seller.role} />
              {" · "}
              {trade.allocatedQuantity} sản phẩm
            </p>
            <button
              onClick={() => void confirm(trade.id)}
              disabled={updating === trade.id}
            >
              <CheckCircle2 size={15} /> Xác nhận đã hoàn tất
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
