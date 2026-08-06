export function ListingCodeBadges({
  productCode,
  orderCode,
  compact = false,
}: {
  productCode?: string | null;
  orderCode?: string | null;
  compact?: boolean;
}) {
  if (!productCode && !orderCode) return null;
  const orderLabel = orderCode?.match(/^D-(\d{6})$/)?.[1];
  return (
    <span className={`listing-code-badges${compact ? " compact" : ""}`}>
      {productCode && (
        <span className="product-code" title="Mã sản phẩm">
          {productCode}
        </span>
      )}
      {orderCode && (
        <span className="order-code" title={`Mã đơn đăng chung: ${orderCode}`}>
          {orderLabel ? `Đơn #${orderLabel}` : orderCode}
        </span>
      )}
    </span>
  );
}
