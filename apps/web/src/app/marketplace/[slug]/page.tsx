import { notFound } from "next/navigation";
import { ListingDetail } from "@/features/listing/listing-detail";
import type { MarketplaceListing } from "@/lib/marketplace-types";

export const dynamic = "force-dynamic";
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const response = await fetch(
    `${apiUrl}/listings/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (!response.ok) notFound();
  return <ListingDetail item={(await response.json()) as MarketplaceListing} />;
}
