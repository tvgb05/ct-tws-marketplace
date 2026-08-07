"use client";

import {
  CheckCircle2,
  LoaderCircle,
  PackageCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminBadge } from "@/components/admin-badge";
import { ListingCodeBadges } from "@/components/listing-code-badges";
import { useAuth } from "@/lib/auth";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Inventory = {
  totalQuantity: number;
  inTransactionQuantity: number;
  soldQuantity: number;
  availableQuantity: number;
};

type Trade = {
  id: string;
  status: "QUEUED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "DECLINED";
  queuePosition: number | null;
  requestedQuantity: number;
  allocatedQuantity: number;
  mediationRequest: {
    id: string;
    status: string;
    assignedAdminId: string | null;
    admin: {
      id: string;
      displayName: string;
      role: "USER" | "ADMIN";
    } | null;
  } | null;
  buyer: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: "USER" | "ADMIN";
  };
  seller: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: "USER" | "ADMIN";
  };
  listing: {
    id: string;
    slug: string;
    title: string;
    status: "AVAILABLE" | "RESERVED" | "SOLD" | "HIDDEN";
    totalQuantity: number;
    reservedQuantity: number;
    soldQuantity: number;
    productCode: string | null;
    orderCode: string | null;
  };
};

export function SellerTradeManager({
  onListingStatusChange,
}: {
  onListingStatusChange?: (
    listingId: string,
    status: "AVAILABLE" | "RESERVED" | "SOLD",
    inventory?: Inventory,
  ) => void;
}) {
  const { user } = useAuth();
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

  const sellerTrades = useMemo(
    () =>
      trades.filter(
        (trade) =>
          trade.seller.id === user?.id &&
          ["ACTIVE", "QUEUED"].includes(trade.status),
      ),
    [trades, user?.id],
  );
  const grouped = useMemo(
    () =>
      Object.values(
        sellerTrades.reduce<Record<string, Trade[]>>((result, trade) => {
          (result[trade.listing.id] ??= []).push(trade);
          return result;
        }, {}),
      ),
    [sellerTrades],
  );

  const update = async (trade: Trade, action: "complete" | "cancel") => {
    setUpdating(trade.id);
    try {
      const response = await fetch(`${apiUrl}/trades/${trade.id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        const result = (await response.json()) as {
          listingStatus: "AVAILABLE" | "RESERVED" | "SOLD";
          inventory: Inventory;
        };
        onListingStatusChange?.(
          trade.listing.id,
          result.listingStatus,
          result.inventory,
        );
        await load();
      }
    } finally {
      setUpdating(null);
    }
  };

  if (loading)
    return (
      <div className="trade-manager-loading">
        <LoaderCircle className="spin" size={18} /> Đang tải giao dịch…
      </div>
    );
  if (grouped.length === 0) return null;

  return (
    <section className="seller-trade-manager">
      <div className="trade-manager-heading">
        <div>
          <span className="section-kicker">ĐƠN BÁN & HÀNG CHỜ</span>
          <h2>Giao dịch đang xử lý</h2>
        </div>
        <span>
          <UsersRound size={16} /> {sellerTrades.length} đơn đang mở
        </span>
      </div>
      <div className="trade-groups">
        {grouped.map((group) => {
          const active = group.filter((trade) => trade.status === "ACTIVE");
          const queued = group
            .filter((trade) => trade.status === "QUEUED")
            .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
          const listing = group[0].listing;
          const available = Math.max(
            0,
            listing.totalQuantity -
              listing.reservedQuantity -
              listing.soldQuantity,
          );
          return (
            <article className="trade-group" key={listing.id}>
              <header>
                <div>
                  <small>
                    {listing.status === "RESERVED"
                      ? "ĐÃ GIỮ HẾT TỒN KHO"
                      : "CÒN NHẬN GIAO DỊCH"}
                  </small>
                  <h3>{listing.title}</h3>
                  <ListingCodeBadges
                    productCode={listing.productCode}
                    orderCode={listing.orderCode}
                    compact
                  />
                </div>
                <b>{queued.length} đơn chờ</b>
              </header>
              <div className="trade-inventory-stats">
                <span>
                  <small>Tổng</small>
                  <strong>{listing.totalQuantity}</strong>
                </span>
                <span>
                  <small>Đang giao dịch</small>
                  <strong>{listing.reservedQuantity}</strong>
                </span>
                <span>
                  <small>Đã bán</small>
                  <strong>{listing.soldQuantity}</strong>
                </span>
                <span>
                  <small>Còn trống</small>
                  <strong>{available}</strong>
                </span>
              </div>
              {active.map((trade) => (
                <div className="active-buyer" key={trade.id}>
                  <span className="trade-avatar">
                    {trade.buyer.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <small>ĐƠN ĐANG GIAO DỊCH</small>
                    <span className="identity-name-line">
                      <Link href={`/users/${trade.buyer.id}`}>
                        <strong>{trade.buyer.displayName}</strong>
                      </Link>
                      <AdminBadge role={trade.buyer.role} />
                    </span>
                    <em>
                      <PackageCheck size={13} /> {trade.allocatedQuantity} sản
                      phẩm
                      {trade.allocatedQuantity < trade.requestedQuantity
                        ? ` · yêu cầu ban đầu ${trade.requestedQuantity}`
                        : ""}
                      {trade.mediationRequest
                        ? " · Trung gian qua quản trị viên"
                        : ""}
                    </em>
                    {trade.mediationRequest?.admin && (
                      <span className="trade-assigned-admin">
                        Phụ trách:{" "}
                        <Link
                          href={`/users/${trade.mediationRequest.admin.id}`}
                        >
                          {trade.mediationRequest.admin.displayName}
                        </Link>
                        <AdminBadge role={trade.mediationRequest.admin.role} />
                      </span>
                    )}
                  </div>
                  <div className="trade-actions">
                    <button
                      onClick={() => void update(trade, "cancel")}
                      disabled={updating === trade.id}
                    >
                      <XCircle size={14} /> Chưa thỏa thuận
                    </button>
                    <button
                      className="complete"
                      onClick={() => void update(trade, "complete")}
                      disabled={
                        updating === trade.id || Boolean(trade.mediationRequest)
                      }
                    >
                      <CheckCircle2 size={14} /> Đã bán{" "}
                      {trade.allocatedQuantity}
                    </button>
                  </div>
                </div>
              ))}
              {queued.length > 0 && (
                <div className="trade-queue">
                  <span>HÀNG CHỜ TỰ ĐỘNG</span>
                  {queued.map((trade, index) => (
                    <div key={trade.id}>
                      <b>{index + 1}</b>
                      <span className="trade-avatar small">
                        {trade.buyer.displayName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="trade-queue-name">
                        <Link href={`/users/${trade.buyer.id}`}>
                          <strong>{trade.buyer.displayName}</strong>
                        </Link>
                        <AdminBadge role={trade.buyer.role} />
                      </span>
                      <small>Chờ {trade.requestedQuantity} sản phẩm</small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
