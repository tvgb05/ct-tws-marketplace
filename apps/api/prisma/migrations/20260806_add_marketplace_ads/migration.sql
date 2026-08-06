CREATE TYPE "MarketplaceAdPlacement" AS ENUM ('MARKETPLACE_LEFT', 'MARKETPLACE_RIGHT');

CREATE TABLE "MarketplaceAd" (
    "id" TEXT NOT NULL,
    "placement" "MarketplaceAdPlacement" NOT NULL,
    "title" TEXT NOT NULL,
    "sponsorName" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "targetUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAd_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceAd_placement_key" ON "MarketplaceAd"("placement");
CREATE INDEX "MarketplaceAd_enabled_idx" ON "MarketplaceAd"("enabled");
