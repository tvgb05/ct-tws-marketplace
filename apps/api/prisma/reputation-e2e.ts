import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apiUrl = "http://localhost:4000/api/v1";
const sellerEmail = "reputation-seller-e2e@local.test";
const buyerEmail = "reputation-buyer-e2e@local.test";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: `tws_session=${token}`,
      ...init.headers,
    },
  });
}

async function cleanup() {
  const testUsers = await prisma.user.findMany({
    where: { email: { in: [sellerEmail, buyerEmail] } },
    select: { id: true },
  });
  const userIds = testUsers.map((user) => user.id);
  if (userIds.length) {
    await prisma.listing.deleteMany({ where: { sellerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function main() {
  await cleanup();
  const category = await prisma.category.findFirst({
    where: { isActive: true },
  });
  assert(category, "Seed at least one category before running this test");

  const [seller, buyer] = await Promise.all([
    prisma.user.create({
      data: { displayName: "E2E Seller", email: sellerEmail },
    }),
    prisma.user.create({
      data: { displayName: "E2E Buyer", email: buyerEmail },
    }),
  ]);
  const listing = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      title: "Reputation E2E Listing",
      slug: `reputation-e2e-${Date.now()}`,
      description: "Temporary listing for reputation flow tests",
      condition: "USED",
      price: 100000,
      location: "Hà Nội",
      deliveryMethod: "MEETUP",
      contactType: "FACEBOOK",
      contactValue: "https://facebook.com/e2e",
      status: "SOLD",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });
  const trade = await prisma.listingTrade.create({
    data: {
      listingId: listing.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      status: "COMPLETED",
      activatedAt: new Date(),
      completedAt: new Date(),
    },
  });

  const jwt = new JwtService({
    secret:
      process.env.JWT_SECRET ?? "local-development-secret-change-me-please",
  });
  const sellerToken = await jwt.signAsync(
    { sub: seller.id, role: "USER" },
    { expiresIn: "15m" },
  );
  const buyerToken = await jwt.signAsync(
    { sub: buyer.id, role: "USER" },
    { expiresIn: "15m" },
  );

  const buyerReviewResponse = await request(
    `/trades/${trade.id}/reviews`,
    buyerToken,
    {
      method: "POST",
      body: JSON.stringify({
        rating: 5,
        comment: "Giao dịch rõ ràng và nhanh chóng.",
      }),
    },
  );
  assert(buyerReviewResponse.status === 201, "Buyer review should be created");

  const duplicateReview = await request(
    `/trades/${trade.id}/reviews`,
    buyerToken,
    {
      method: "POST",
      body: JSON.stringify({ rating: 4 }),
    },
  );
  assert(duplicateReview.status === 409, "Duplicate review should be rejected");

  const sellerReviewResponse = await request(
    `/trades/${trade.id}/reviews`,
    sellerToken,
    {
      method: "POST",
      body: JSON.stringify({
        rating: 4,
        comment: "Người mua trao đổi lịch sự.",
      }),
    },
  );
  assert(
    sellerReviewResponse.status === 201,
    "Seller review should be created",
  );

  const profileResponse = await request(
    `/users/${seller.id}/profile`,
    buyerToken,
  );
  assert(profileResponse.ok, "Seller profile should load");
  const profile = (await profileResponse.json()) as {
    stats: {
      salesCount: number;
      reviewCount: number;
      averageRating: number | null;
    };
    recentReviews: Array<{ trade: { listing: { title: string } } }>;
  };
  assert(profile.stats.salesCount === 1, "Seller sales count should be 1");
  assert(profile.stats.reviewCount === 1, "Seller review count should be 1");
  assert(profile.stats.averageRating === 5, "Seller average should be 5");
  assert(
    profile.recentReviews[0]?.trade.listing.title === listing.title,
    "Recent review should expose the verified listing",
  );

  const reportResponse = await request(
    `/users/${seller.id}/reports`,
    buyerToken,
    {
      method: "POST",
      body: JSON.stringify({ reason: "OTHER", description: "E2E user report" }),
    },
  );
  assert(reportResponse.status === 201, "User report should be created");

  const duplicateReport = await request(
    `/users/${seller.id}/reports`,
    buyerToken,
    {
      method: "POST",
      body: JSON.stringify({ reason: "SPAM" }),
    },
  );
  assert(
    duplicateReport.status === 409,
    "Duplicate open report should be rejected",
  );

  const adminLogin = await fetch(`${apiUrl}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
      remember: false,
    }),
  });
  assert(adminLogin.ok, "Seed admin should log in");
  const adminCookie = adminLogin.headers.get("set-cookie")?.split(";", 1)[0];
  assert(adminCookie, "Admin login should set a session cookie");
  const overview = await fetch(`${apiUrl}/admin/overview`, {
    headers: { Cookie: adminCookie },
  });
  assert(overview.ok, "Admin overview should load");
  const overviewBody = (await overview.json()) as {
    recentUserReports: Array<{ reportedUser: { id: string } }>;
  };
  assert(
    overviewBody.recentUserReports.some(
      (report) => report.reportedUser.id === seller.id,
    ),
    "User report should appear in admin overview",
  );

  console.info("PASS buyer_and_seller_review_each_other");
  console.info("PASS duplicate_review_rejected");
  console.info("PASS verified_profile_reputation_stats");
  console.info("PASS user_report_sent_to_admin");
  console.info("PASS duplicate_open_report_rejected");
}

main()
  .finally(cleanup)
  .finally(() => prisma.$disconnect());
