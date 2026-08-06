import { notFound } from "next/navigation";
import { ListingDetail } from "@/features/listing/listing-detail";
import type { MarketplaceListing } from "@/lib/marketplace-types";
import { serverApiUrl } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const response = await fetch(
    `${serverApiUrl()}/listings/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (!response.ok) notFound();
  return <ListingDetail item={(await response.json()) as MarketplaceListing} />;
}
