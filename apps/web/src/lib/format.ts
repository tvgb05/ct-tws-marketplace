const commaNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export const formatPrice = (price: number) => `${commaNumber.format(price)} đ`;

export const parsePriceInput = (value: string) =>
  value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

export const formatPriceInput = (value: string) => {
  const digits = parsePriceInput(value);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
