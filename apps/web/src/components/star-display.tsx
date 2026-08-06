import { Star } from "lucide-react";

export function StarDisplay({
  value,
  label,
  size = 16,
}: {
  value: number;
  label?: string;
  size?: number;
}) {
  return (
    <span
      className="star-display"
      aria-label={label ?? `${value} trên 5 sao`}
      title={label ?? `${value} trên 5 sao`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= Math.round(value) ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
