import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apiUrl = "http://localhost:4000/api/v1";
const testPrefix = "inventory-e2e-";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request(path: string, token: string, body?: unknown) {
  return fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `tws_session=${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: testPrefix } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (!userIds.length) return;
  await prisma.listing.deleteMany({ where: { sellerId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  await cleanup();
  const category = await prisma.category.findFirst({ where: { isActive: true } });
  assert(category, "Seed categories before running inventory E2E");
  const seller = await prisma.user.create({
    data: {
      displayName: "Inventory E2E Seller",
      email: `${testPrefix}seller@local.test`,
      phoneNumber: "0000000000",
      facebookProfileUrl: "https://facebook.com/profile.php?id=0",
      profileCompletedAt: new Date(),
    },
  });
  const buyers = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      prisma.user.create({
        data: {
          displayName: `Inventory E2E Buyer ${index + 1}`,
          email: `${testPrefix}buyer-${index + 1}@local.test`,
        },
      }),
    ),
  );
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? "local-development-secret-change-me-please",
  });
  const sellerToken = await jwt.signAsync({ sub: seller.id, role: "USER" });
  const buyerTokens = await Promise.all(
    buyers.map((buyer) => jwt.signAsync({ sub: buyer.id, role: "USER" })),
  );

  const batchResponse = await request("/listings/batch", sellerToken, {
    items: [
      {
        title: "Public Code E2E Product One",
        categoryId: category.id,
        subcategory: "miscellaneous",
        condition: "NEW",
        price: 100000,
        quantity: 1,
      },
      {
        title: "Public Code E2E Product Two",
        categoryId: category.id,
        subcategory: "miscellaneous",
        condition: "USED",
        price: 200000,
        quantity: 2,
      },
    ],
    description: "Temporary shared-photo batch for public code search testing.",
    location: "Hà Nội",
    deliveryMethod: "MEETUP",
    allowAdminMediation: true,
    sellerPolicyAccepted: true,
    images: [
      {
        publicId: "inventory-e2e/public-code",
        secureUrl: "https://images.example.com/inventory-e2e.png",
      },
    ],
  });
  assert(batchResponse.status === 201, "Shared-photo batch should be created");
  const batch = await batchResponse.json();
  assert(batch.length === 2, "Batch should create two products");
  assert(batch[0].orderCode === batch[1].orderCode, "Shared-photo products should share one order code");
  assert(batch[0].productCode !== batch[1].productCode, "Each product should have a distinct product code");
  const orderSearch = await fetch(
    `${apiUrl}/listings?search=${encodeURIComponent(batch[0].orderCode)}&limit=50`,
  ).then((response) => response.json());
  const productSearch = await fetch(
    `${apiUrl}/listings?search=${encodeURIComponent(batch[0].productCode)}&limit=50`,
  ).then((response) => response.json());
  assert(
    orderSearch.data.filter((listing: { orderCode: string }) => listing.orderCode === batch[0].orderCode).length === 2,
    "Order-code search should return both shared-photo products",
  );
  assert(
    productSearch.data.filter((listing: { productCode: string }) => listing.productCode === batch[0].productCode).length === 1,
    "Product-code search should return exactly one product",
  );

  const queueListing = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      title: "Inventory E2E Queue",
      slug: `inventory-e2e-queue-${Date.now()}`,
      description: "Temporary five-unit listing for automatic queue allocation",
      condition: "NEW",
      price: 100000,
      totalQuantity: 5,
      location: "Hà Nội",
      deliveryMethod: "MEETUP",
      contactType: "FACEBOOK",
      contactValue: "https://facebook.com/e2e",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });
  const queueResponses = await Promise.all(
    buyerTokens.slice(0, 6).map((token) =>
      request(`/listings/${queueListing.id}/contact`, token, { quantity: 1 }),
    ),
  );
  assert(queueResponses.every((response) => response.status === 201), "All six requests should be accepted");
  const queueResults = await Promise.all(queueResponses.map((response) => response.json()));
  const active = queueResults.filter((result) => result.trade.status === "ACTIVE");
  const queued = queueResults.filter((result) => result.trade.status === "QUEUED");
  assert(active.length === 5, "Five one-unit orders should be active");
  assert(queued.length === 1, "The sixth one-unit order should be queued");
  const fullInventory = await prisma.listing.findUniqueOrThrow({ where: { id: queueListing.id } });
  assert(fullInventory.reservedQuantity === 5, "All five units should be reserved");
  assert(fullInventory.status === "RESERVED", "Listing should be reserved when no stock is free");

  const cancelledResponse = await request(
    `/trades/${active[0].trade.id}/cancel`,
    sellerToken,
  );
  assert(cancelledResponse.status === 201, "Seller should be able to cancel an active order");
  const promoted = await prisma.listingTrade.findUniqueOrThrow({
    where: { id: queued[0].trade.id },
  });
  assert(promoted.status === "ACTIVE", "First queued order should be promoted automatically");
  assert(promoted.allocatedQuantity === 1, "Promoted order should receive one unit");
  const promotedInventory = await prisma.listing.findUniqueOrThrow({ where: { id: queueListing.id } });
  assert(promotedInventory.reservedQuantity === 5, "FIFO promotion should immediately reserve the released unit");

  const partialListing = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      title: "Inventory E2E Partial",
      slug: `inventory-e2e-partial-${Date.now()}`,
      description: "Temporary five-unit listing for partial stock allocation",
      condition: "NEW",
      price: 120000,
      totalQuantity: 5,
      location: "Hà Nội",
      deliveryMethod: "MEETUP",
      contactType: "FACEBOOK",
      contactValue: "https://facebook.com/e2e",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });
  const firstResponse = await request(
    `/listings/${partialListing.id}/contact`,
    buyerTokens[6],
    { quantity: 4 },
  );
  const secondResponse = await request(
    `/listings/${partialListing.id}/contact`,
    buyerTokens[7],
    { quantity: 2 },
  );
  assert(firstResponse.status === 201 && secondResponse.status === 201, "Partial-allocation requests should succeed");
  const first = await firstResponse.json();
  const second = await secondResponse.json();
  assert(first.trade.allocatedQuantity === 4, "First buyer should receive four units");
  assert(second.trade.requestedQuantity === 2, "Second buyer request should remain recorded as two");
  assert(second.trade.allocatedQuantity === 1, "Second buyer should only receive the final unit");
  assert(second.trade.status === "ACTIVE", "Partially allocated order should be active, not queued");
  const partialInventory = await prisma.listing.findUniqueOrThrow({ where: { id: partialListing.id } });
  assert(partialInventory.reservedQuantity === 5, "Partial allocations must not oversell stock");

  const completeFirst = await request(
    `/trades/${first.trade.id}/complete`,
    sellerToken,
  );
  assert(completeFirst.status === 201, "Four-unit order should complete");
  const afterFirstCompletion = await prisma.listing.findUniqueOrThrow({ where: { id: partialListing.id } });
  assert(afterFirstCompletion.soldQuantity === 4, "Completed quantity should increase sold units by four");
  assert(afterFirstCompletion.reservedQuantity === 1, "Second buyer's one unit should remain reserved");
  assert(afterFirstCompletion.status === "RESERVED", "Listing should remain reserved while final unit is active");
  const completeSecond = await request(
    `/trades/${second.trade.id}/complete`,
    sellerToken,
  );
  assert(completeSecond.status === 201, "Final one-unit order should complete");
  const soldOut = await prisma.listing.findUniqueOrThrow({ where: { id: partialListing.id } });
  assert(soldOut.soldQuantity === 5 && soldOut.reservedQuantity === 0, "Final inventory should be five sold and zero reserved");
  assert(soldOut.status === "SOLD", "Listing should only become sold after all five units complete");

  console.info("Inventory E2E passed: public codes, queue allocation, FIFO promotion, partial allocation, and sold counters.");
}

main()
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
